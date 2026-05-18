# GIA → Claude-Level Upgrade Spec
## Full agent instructions · Built on GIA v2.2.0 codebase · May 2026
## Goal: Make GIA feel, think, remember, and respond as close to Claude as possible

---

## WHAT MAKES CLAUDE, CLAUDE — AND HOW TO REPLICATE IT IN GIA

### The 7 pillars Claude is built on:
1. **Deep persistent memory** — knows who you are across every conversation
2. **Visible real-time reasoning** — shows thinking live, not hidden
3. **Reliable tool execution** — tools work every time, confirmed, no silent failures
4. **Calibrated responses** — knows when to be brief, when to go deep
5. **Honest self-awareness** — knows what it can and can't do
6. **Graceful failure** — when something breaks, it says so clearly
7. **Proactive intelligence** — notices things you didn't ask about

GIA has the skeleton for all 7. This spec tells the agent exactly how to flesh each one out.

---

## PART 1 — MEMORY SYSTEM OVERHAUL
### Target file: `src/store/useMemoryStore.ts` + `src/services/GiaBrain.ts`

### What Claude does:
- Remembers your name, goals, profession, preferences, past conversations
- Surfaces relevant memories automatically without being asked
- Updates memories when you correct it
- Forgets things you ask it to forget
- Distinguishes between short-term (this session) and long-term (across sessions)

### What GIA currently does:
- Has a memory store with 200 max entries
- Only surfaces top 10 by confidence score
- Never auto-extracts memories from conversations
- Memory context is a flat string appended to system prompt
- No short-term vs long-term distinction

### What the agent must build:

#### 1A. Auto-Memory Extraction After Every Response
In `GiaBrain.ts`, after every successful `generate()` call, run a lightweight extraction pass:

```typescript
// Add to GiaBrain.ts — call this after every generate() resolves
private async extractMemories(userMessage: string, assistantResponse: string) {
  const { memories } = useMemoryStore.getState();
  
  // Only extract if the conversation contains personal information
  const extractionPrompt = `Analyze this conversation exchange and extract any facts worth remembering about the user.
  
User said: "${userMessage.slice(0, 500)}"
Assistant said: "${assistantResponse.slice(0, 500)}"

Extract ONLY concrete, specific facts about the USER (not general knowledge).
Categories: name, age, location, profession, goals, preferences, struggles, projects, skills, relationships.

If nothing worth remembering, return: []

Return JSON array only, no other text:
[{"key": "user_name", "value": "Sam", "category": "profile", "confidence": 0.95}]

Valid categories: "profile" | "subject" | "score" | "weak_area" | "fact" | "preference" | "session_summary"`;

  try {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (!config.apiKey) return;
    
    const res = await this.generate({
      prompt: extractionPrompt,
      systemPrompt: 'You are a memory extraction assistant. Return only valid JSON arrays. Never include markdown.',
      maxTokens: 300,
      temperature: 0.1,
    });
    
    const cleaned = res.text.replace(/```json|```/g, '').trim();
    const entries = JSON.parse(cleaned);
    if (Array.isArray(entries) && entries.length > 0) {
      useMemoryStore.getState().addMemories(entries);
    }
  } catch {
    // Silent — memory extraction failure should never break the main flow
  }
}
```

Call `extractMemories(userPrompt, response.text)` at the end of `generate()` before returning, but only if the response is not empty and not a tool result.

#### 1B. Smarter Memory Context — Relevance Scoring
Replace `getRelevantContext()` in `useMemoryStore.ts` with a query-aware version:

```typescript
getRelevantContext: (query?: string) => {
  const { memories } = get();
  if (memories.length === 0) return '';
  
  let scored = memories.map(m => ({
    ...m,
    relevanceScore: m.confidence,
  }));
  
  // Boost memories that match keywords in the current query
  if (query) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    scored = scored.map(m => {
      const text = `${m.key} ${m.value}`.toLowerCase();
      const matches = words.filter(w => text.includes(w)).length;
      return { ...m, relevanceScore: m.confidence + (matches * 0.2) };
    });
  }
  
  const top = scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 15);
  
  if (top.length === 0) return '';
  
  // Format like Claude's memory context
  const lines = top.map(m => `- ${m.key}: ${m.value}`).join('\n');
  return `\n\n## What GIA remembers about you:\n${lines}`;
},
```

Update `buildGiaSystem()` in `GiaBrain.ts` to pass the current prompt as context:
```typescript
// Change this line in buildGiaSystem():
const memory = useMemoryStore.getState().getRelevantContext();
// To accept prompt parameter — buildGiaSystem(currentPrompt?: string)
const memory = useMemoryStore.getState().getRelevantContext(currentPrompt);
```

#### 1C. Add Memory Categories Missing from Current Store
Add these to `MemoryCategory` type in `useMemoryStore.ts`:
```typescript
export type MemoryCategory = 
  | 'profile'          // name, age, location
  | 'subject'          // what they're studying
  | 'score'            // exam/quiz scores  
  | 'weak_area'        // topics they struggle with
  | 'fact'             // general facts about them
  | 'preference'       // how they like things done
  | 'session_summary'  // summary of past conversations
  | 'project'          // NEW: projects they're working on
  | 'correction'       // NEW: things they corrected GIA about
  | 'emotion'          // NEW: how they were feeling (use sparingly)
  | 'goal';            // NEW: explicit goals they stated
```

#### 1D. Add a "Forget This" Tool to GiaTools.ts
```typescript
this.tools.set('forget_memory', {
  id: 'forget_memory',
  name: 'forget_memory', 
  description: 'Delete a specific memory or all memories matching a topic.',
  execute: async ({ key, all = false }) => {
    const store = useMemoryStore.getState();
    if (all) {
      store.clearMemories();
      return { success: true, content: 'All memories cleared.' };
    }
    const matches = store.queryMemories(key);
    matches.forEach(m => store.deleteMemory(m.id));
    return { 
      success: true, 
      content: matches.length > 0 
        ? `Forgot ${matches.length} memor${matches.length === 1 ? 'y' : 'ies'} about "${key}".`
        : `No memories found matching "${key}".`
    };
  }
});
```

#### 1E. Add Session Summary Memory
At the end of every conversation (when user starts a new session), summarize the last session:

```typescript
// Add to useGiaStore.ts → createSession():
createSession: () => {
  const id = genId();
  const { sessions, activeSessionId } = get();
  
  // Summarize the previous session before creating new one
  const prevSession = sessions.find(s => s.id === activeSessionId);
  if (prevSession && prevSession.messages.length >= 4) {
    const summary = prevSession.messages
      .slice(-6)
      .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
      .join('\n');
    
    useMemoryStore.getState().addMemory({
      key: `session_${new Date().toLocaleDateString()}`,
      value: summary,
      category: 'session_summary',
      confidence: 0.6,
    });
  }
  
  set((s) => ({
    sessions: [{ id, title: 'New Chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() }, ...s.sessions],
    activeSessionId: id,
  }));
  return id;
},
```

---

## PART 2 — REAL-TIME THINKING DISPLAY
### Target files: `src/modules/ChatModule.tsx` + `src/styles/globals.css`

### What Claude does:
- Shows a live "Thinking..." panel that streams reasoning tokens in real time
- Collapses to "Show thinking" button once response starts
- Thinking is visually distinct (different color, italic, monospace)
- Even for non-extended-thinking, shows "working..." indicators

### What GIA currently does:
- Has `thoughtsAccumulated` populated correctly during streaming
- But only shows it AFTER the message finishes (collapsed toggle button)
- During streaming: just 3 dots. No thought content visible at all.

### What the agent must build:

#### 2A. Live Thinking Panel Component
Create new file `src/components/ThinkingPanel.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { Brain } from 'lucide-react';

interface ThinkingPanelProps {
  thoughts: string;
  isLive: boolean; // true = still streaming, false = complete
  isExpanded: boolean;
  onToggle: () => void;
}

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({ 
  thoughts, isLive, isExpanded, onToggle 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom while live
  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts, isLive]);

  if (!thoughts && !isLive) return null;

  return (
    <div className="mt-2 rounded-xl overflow-hidden" 
         style={{ border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.03)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ color: '#f59e0b' }}
      >
        <Brain size={12} />
        <span className="text-[11px] font-medium">
          {isLive ? (
            <span className="flex items-center gap-1.5">
              Reasoning
              <span className="flex gap-0.5">
                {[0,1,2].map(i => (
                  <span key={i} className="thinking-dot" 
                        style={{ animationDelay: `${i * 0.16}s`, background: '#f59e0b' }} />
                ))}
              </span>
            </span>
          ) : (
            `${isExpanded ? 'Hide' : 'Show'} reasoning`
          )}
        </span>
        {!isLive && (
          <span className="ml-auto text-[10px] opacity-50">
            {thoughts.split(' ').length} words
          </span>
        )}
      </button>
      
      {(isExpanded || isLive) && thoughts && (
        <div
          ref={scrollRef}
          className="px-3 pb-3 text-[11px] leading-relaxed font-mono max-h-40 overflow-y-auto"
          style={{ color: '#d4a574', whiteSpace: 'pre-wrap' }}
        >
          {thoughts}
          {isLive && <span className="animate-pulse">▋</span>}
        </div>
      )}
    </div>
  );
};
```

#### 2B. Wire ThinkingPanel into ChatModule message rendering
In `ChatModule.tsx`, replace the static `msg.thoughts` block with the live panel:

```typescript
// Add to state at top of ChatModule:
const [liveThoughts, setLiveThoughts] = useState<Record<string, string>>({});
// liveThoughts[msgId] = current thought string during streaming

// In the onStream/onThought handlers — update liveThoughts during streaming:
onThought: (thought) => {
  thoughtsAccumulated += (thoughtsAccumulated ? '\n' : '') + thought;
  setLiveThoughts(prev => ({ ...prev, [asstId]: thoughtsAccumulated }));
  updateMessage(sessionId!, asstId, accumulated.replace(/```tool[\s\S]*?```/g, '').trim() || '…', thoughtsAccumulated);
},

// After streaming completes — remove from liveThoughts (it's now in msg.thoughts):
// In the finally block:
setLiveThoughts(prev => { const n = {...prev}; delete n[asstId]; return n; });

// In JSX, replace the static thoughts block with:
{(liveThoughts[msg.id] || msg.thoughts) && (
  <ThinkingPanel
    thoughts={liveThoughts[msg.id] || msg.thoughts || ''}
    isLive={!!liveThoughts[msg.id]}
    isExpanded={showThoughts.has(msg.id) || !!liveThoughts[msg.id]}
    onToggle={() => setShowThoughts(prev => {
      const n = new Set(prev);
      n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id);
      return n;
    })}
  />
)}
```

#### 2C. Universal Thinking for ALL Providers (Not Just Anthropic)
In `GiaBrain.ts` → `callOpenAICompat()`, replace the current thinking instruction with a proper chain-of-thought system:

```typescript
// Replace the current useExtendedThinking block with:
if (req.useExtendedThinking) {
  // For models that support native reasoning (o1, o3, deepseek-reasoner):
  const isNativeReasoner = config.model.startsWith('o1') || 
                            config.model.startsWith('o3') || 
                            config.model.includes('deepseek-reasoner') ||
                            config.model.includes('qwq');
  
  if (!isNativeReasoner) {
    // For all other models: inject explicit think-step structure
    messages.splice(1, 0, {
      role: 'user',
      content: `Before answering, think step by step. Write your reasoning inside <think></think> tags, then give your final answer.`
    });
    messages.splice(2, 0, {
      role: 'assistant', 
      content: '<think>'
    });
  }
}
```

Then in the stream processor, detect `<think>` blocks in real time and route them to `onThought`:

```typescript
// In processLines() — add think-block detection:
let inThinkBlock = false;
let thinkBuffer = '';

// For each delta token:
if (delta.includes('<think>')) {
  inThinkBlock = true;
  thinkBuffer = delta.split('<think>')[1] || '';
  req.onThought?.(thinkBuffer);
} else if (delta.includes('</think>')) {
  inThinkBlock = false;
  const closing = delta.split('</think>')[0];
  req.onThought?.(thinkBuffer + closing);
  thinkBuffer = '';
  // Continue with rest of delta as normal text
  const afterThink = delta.split('</think>')[1] || '';
  if (afterThink) { fullText += afterThink; req.onStream!(afterThink); }
} else if (inThinkBlock) {
  thinkBuffer += delta;
  req.onThought?.(thinkBuffer);
} else {
  fullText += delta;
  req.onStream!(delta);
}
```

---

## PART 3 — RESPONSE QUALITY & CALIBRATION
### Target file: `src/services/GiaBrain.ts` + `src/store/useGiaStore.ts`

### What Claude does:
- Short questions get short answers
- Complex questions get structured, thorough answers  
- Never starts with "Certainly!" or "Of course!" or "Great question!"
- Knows when to use markdown vs plain text
- Adapts tone to context (casual vs technical vs emotional)

### What GIA currently does:
- Fixed temperature 0.7 for everything
- No response length calibration
- System prompt doesn't enforce tone calibration
- Models often over-explain or under-explain

### What the agent must build:

#### 3A. Calibrated System Prompt — Replace the current GIA system prompt entirely
In `GiaBrain.ts` → `buildGiaSystem()`, add these sections to the base system:

```typescript
// Add after the existing Guidelines section:

`## Response Calibration Rules (FOLLOW EXACTLY)
1. Match response length to question complexity:
   - Simple factual questions → 1-3 sentences
   - How-to questions → numbered steps, no fluff
   - Complex analysis → structured with headers if >4 sections
   - Emotional/personal messages → conversational, no lists
   
2. NEVER start a response with:
   - "Certainly!", "Of course!", "Great question!", "Absolutely!"
   - "I'd be happy to...", "Sure!", "Definitely!"
   - Restating what the user just said
   
3. Lead with the answer, then the reasoning. Not the other way around.

4. Use markdown only when it genuinely helps:
   - Code → always in code blocks
   - Steps → numbered list
   - Comparisons → table
   - Conversation → plain prose, no bullet points
   
5. When you don't know something, say so directly. Don't guess and present it as fact.

6. If the user seems frustrated or stressed, acknowledge it in ONE sentence before helping.

7. Never pad responses. If the answer is 2 sentences, write 2 sentences.`
```

#### 3B. Dynamic Temperature Based on Task Type
In `GiaBrain.ts` → `generate()`, auto-detect task type and set temperature:

```typescript
// Add before the while loop in generate():
const detectTemperature = (prompt: string): number => {
  const p = prompt.toLowerCase();
  // Creative tasks → higher temperature
  if (p.includes('write a') || p.includes('create a story') || p.includes('poem') || p.includes('creative')) return 0.9;
  // Code/technical → lower temperature  
  if (p.includes('code') || p.includes('function') || p.includes('debug') || p.includes('error') || p.includes('fix')) return 0.2;
  // Analysis → medium-low
  if (p.includes('analyze') || p.includes('explain') || p.includes('why') || p.includes('how does')) return 0.4;
  // Factual → very low
  if (p.includes('what is') || p.includes('define') || p.includes('when did') || p.includes('who is')) return 0.1;
  // Default conversational
  return 0.7;
};

const autoTemp = req.temperature ?? detectTemperature(req.prompt);
// Use autoTemp instead of hardcoded 0.7 in all provider calls
```

---

## PART 4 — TOOL RELIABILITY & VERIFICATION
### Target file: `src/services/GiaTools.ts`

### What Claude does:
- Every tool call confirms success or failure explicitly
- File operations verify the file exists after writing
- Downloads confirm the file was received
- Never lies about what happened

### What the agent must build:

#### 4A. Verified File Write
```typescript
// Replace filesystem_write execute():
execute: async ({ path, content }) => {
  const platform = (window as any).Capacitor?.getPlatform?.();
  const isAndroid = platform === 'android' || platform === 'ios';
  
  if (isAndroid) {
    try {
      await Filesystem.writeFile({
        path,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true
      });
      
      // VERIFY the file was actually written
      const stat = await Filesystem.stat({ path, directory: Directory.Documents });
      if (!stat || stat.size === 0) {
        return { success: false, content: '', error: `File was written but appears empty. Size: ${stat?.size ?? 'unknown'}` };
      }
      
      return { 
        success: true, 
        content: `✅ File saved: ${path} (${stat.size} bytes)\nLocation: Documents/${path}` 
      };
    } catch (e: any) {
      return { success: false, content: '', error: `Write failed: ${e.message}` };
    }
  }
  
  // Browser fallback
  try {
    const ext = path.split('.').pop()?.toLowerCase() || 'txt';
    const mimeMap: Record<string, string> = { 
      txt: 'text/plain', md: 'text/markdown', html: 'text/html', 
      css: 'text/css', js: 'text/javascript', ts: 'text/typescript', 
      py: 'text/x-python', json: 'application/json', csv: 'text/csv' 
    };
    const mime = mimeMap[ext] || 'text/plain';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { success: true, content: `File "${path}" prepared for download.` };
  } catch (e: any) {
    return { success: false, content: '', error: e.message };
  }
}
```

#### 4B. Fix sub_agent_call — Move Before getTool() in generate() loop
In `GiaBrain.ts` → `generate()` loop, reorder the tool dispatch:

```typescript
// CURRENT ORDER (broken):
// if (toolCall.id === 'request_clarification') { ... }
// const tool = GiaTools.getTool(toolCall.id)  ← catches sub_agent_call first
// if (tool) { ... }
// else if (toolCall.id === 'sub_agent_call') { ... }  ← never reached

// CORRECT ORDER:
if (toolCall.id === 'request_clarification') {
  // ... clarification handler
} else if (toolCall.id === 'sub_agent_call') {
  // ... delegation handler  
} else {
  const tool = GiaTools.getTool(toolCall.id);
  if (tool) {
    // ... normal tool execution
  }
}
```

#### 4C. Add a "read_url" Tool (Like Claude's Web Fetch)
```typescript
this.tools.set('read_url', {
  id: 'read_url',
  name: 'read_url',
  description: 'Fetch and read the content of any URL. Use for reading articles, documentation, GitHub files, or any webpage.',
  execute: async ({ url }) => {
    try {
      const brain = GiaBrain; // Already imported
      const content = await brain.fetchURL(url);
      return { success: true, content };
    } catch (e: any) {
      return { success: false, content: '', error: `Could not fetch ${url}: ${e.message}` };
    }
  }
});
```

#### 4D. Add a "summarize_conversation" Tool
```typescript
this.tools.set('summarize_conversation', {
  id: 'summarize_conversation',
  name: 'summarize_conversation',
  description: 'Summarize the current conversation and optionally save it as a memory.',
  execute: async ({ save = true }) => {
    const { sessions, activeSessionId } = useGiaStore.getState();
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session || session.messages.length === 0) {
      return { success: false, content: '', error: 'No active conversation to summarize.' };
    }
    
    const transcript = session.messages
      .filter(m => m.content && !m.thinking)
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'User' : 'GIA'}: ${m.content.slice(0, 200)}`)
      .join('\n');
    
    if (save) {
      useMemoryStore.getState().addMemory({
        key: `conversation_${new Date().toLocaleDateString()}`,
        value: transcript,
        category: 'session_summary',
        confidence: 0.7,
      });
    }
    
    return { success: true, content: `Conversation summarized${save ? ' and saved to memory' : ''}:\n\n${transcript}` };
  }
});
```

---

## PART 5 — MICROPHONE & VOICE — FULL REWRITE
### Target files: `src/hooks/useVoiceControl.ts` + `src/components/AmbientInput.tsx`

### What Claude does:
- Has a clean single mic session — one at a time
- No infinite loops
- Transcribes, shows the text, waits for you to send

### What the agent must build:

#### 5A. Rewrite useVoiceControl.ts — Kill the Loop
```typescript
// Replace listenOnce() entirely. 
// The problem: it calls SpeechRecognition.start() then re-arms itself recursively.
// The fix: use addListener for partial results instead of polling.

const listenOnce = useCallback(async () => {
  if (!activeRef.current) return;
  try {
    if (isCapacitor) {
      const { available } = await SpeechRecognition.available();
      if (!available) { setIsListening(false); return; }

      // Use event listener for partial results instead of polling start()
      await SpeechRecognition.addListener('partialResults', (data: any) => {
        if (data.matches && data.matches.length > 0) {
          setIsHearing(true);
          onTranscript?.(data.matches[0]);
        }
      });

      const result = await SpeechRecognition.start({
        language: 'en-US',
        partialResults: true,
        popup: false,
        maxResults: 1,
      });

      if (result?.matches?.length) {
        processTranscript(result.matches[0]);
      }
      
      setIsHearing(false);
      
      // Only re-arm if keepListening is explicitly true AND still active
      if (activeRef.current && keepListening) {
        // Minimum 1.5s gap between sessions to prevent mic spam
        setTimeout(listenOnce, 1500);
      } else {
        stopListening();
      }
    }
  } catch (e: any) {
    console.error('Speech recognition error:', e);
    setIsHearing(false);
    if (activeRef.current && keepListening) {
      setTimeout(listenOnce, 3000); // Longer back-off on error
    } else {
      stopListening();
    }
  }
}, [isCapacitor, processTranscript, keepListening, stopListening]);
```

#### 5B. Remove Duplicate Mic System from AmbientInput.tsx
In `AmbientInput.tsx`, delete the entire `toggleListening` function and `isListening` state.
Replace the mic button with props passed from ChatModule:

```typescript
// Add to AmbientInputProps interface:
interface AmbientInputProps {
  // ... existing props
  isVoiceListening?: boolean;
  onVoiceToggle?: () => void;
}

// Replace the mic button JSX with:
{onVoiceToggle && (
  <button
    onClick={onVoiceToggle}
    className="..."
    style={{ color: isVoiceListening ? '#ec4899' : 'var(--gia-muted)' }}
  >
    {isVoiceListening ? <MicOff size={16} /> : <Mic size={16} />}
  </button>
)}
```

In `ChatModule.tsx`, pass voice control to AmbientInput:
```typescript
<AmbientInput 
  // ... existing props
  isVoiceListening={voiceControl.isListening}
  onVoiceToggle={() => voiceEnabled ? voiceControl.stopListening() : voiceControl.startListening()}
/>
```

---

## PART 6 — HONEST FAILURE HANDLING
### Target files: `src/modules/ChatModule.tsx` + `src/services/GiaBrain.ts`

### What Claude does:
- Empty response → explicit error message, never blank
- Network failure → clear message with retry option
- Aborted response → "[Response stopped]" marker on the partial message
- Never shows a blank white bubble

### What the agent must build:

#### 6A. Empty Response Guard in GiaBrain.ts
In all three provider methods (`callOpenAICompat`, `callAnthropic`, `callGeminiNative`), add after streaming completes:

```typescript
// At the end of each streaming path, before resolve():
if (fullText.trim() === '' && !req.signal?.aborted) {
  reject(new Error(`Empty response received from ${activeProvider}. The model returned no content. Try again or switch providers in Settings.`));
  return;
}
resolve({ text: fullText, provider: activeProvider, model: config.model });
```

#### 6B. Stopped Response Marker
In `ChatModule.tsx` → `handleStop()`:

```typescript
const handleStop = useCallback(() => {
  abortRef.current?.abort();
  TTSService.stop();
  
  if (streamingMsgId && activeSessionId) {
    const session = useGiaStore.getState().sessions.find(s => s.id === activeSessionId);
    const ghost = session?.messages.find(m => m.id === streamingMsgId);
    
    if (ghost) {
      if (!ghost.content || ghost.thinking) {
        // No content at all — remove the ghost message
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === activeSessionId
              ? { ...s, messages: s.messages.filter(m => m.id !== streamingMsgId) }
              : s
          ),
        });
      } else {
        // Has partial content — keep it with a stopped marker
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === activeSessionId
              ? { 
                  ...s, 
                  messages: s.messages.map(m => 
                    m.id === streamingMsgId 
                      ? { ...m, content: m.content + '\n\n*— Response stopped —*', thinking: false }
                      : m
                  )
                }
              : s
          ),
        });
      }
    }
  }
  
  setLoading(false);
  setStreamingMsgId(null);
  setIntentState('idle');
}, [setIntentState, streamingMsgId, activeSessionId]);
```

#### 6C. No-API-Key Banner
In `ChatModule.tsx`, add at the top of the messages area:

```typescript
// Add this check:
const { activeProvider, providers } = useProviderStore();
const hasApiKey = providers[activeProvider]?.apiKey;

// Add this JSX above the messages list:
{!hasApiKey && (
  <div 
    className="mx-4 mt-3 px-4 py-3 rounded-xl text-[12px] flex items-center gap-2 cursor-pointer"
    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
    onClick={() => useGiaStore.getState().setModule('settings')}
  >
    <AlertCircle size={14} />
    <span>No API key configured — tap here to set up your AI provider</span>
  </div>
)}
```

---

## PART 7 — FLOATING STOP BUTTON + UX POLISH
### Target file: `src/modules/ChatModule.tsx`

#### 7A. Floating Stop Button
```typescript
// Add above AmbientInput in JSX:
{loading && (
  <div className="flex justify-center mb-2">
    <button
      onClick={handleStop}
      className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium"
      style={{ 
        background: 'rgba(239,68,68,0.15)', 
        border: '1px solid rgba(239,68,68,0.3)', 
        color: '#f87171',
        backdropFilter: 'blur(8px)'
      }}
    >
      <Square size={12} fill="#f87171" />
      Stop generating
    </button>
  </div>
)}
```

#### 7B. Wire SchedulerService Into App Boot
In `src/main.tsx` or `src/App.tsx`, import and boot the scheduler:

```typescript
// Add to App.tsx or main.tsx:
import SchedulerService from './services/SchedulerService';

// In App component, add:
useEffect(() => {
  SchedulerService.start();
  return () => SchedulerService.stop();
}, []);
```

#### 7C. Wake Word Live Update
In `ChatModule.tsx`, replace the static `wakeWordRef`:

```typescript
// Remove:
const wakeWordRef = useRef(localStorage.getItem('gia-wake-word') || 'hey gia');

// Add to useGiaStore: wakeWord: string (persisted)
// Then in ChatModule:
const wakeWord = useGiaStore(s => s.wakeWord) || 'hey gia';

// Update useVoiceControl config:
const voiceControl = useVoiceControl({
  wakeWord, // now reactive
  // ... rest
});
```

---

## PART 8 — SYSTEM PROMPT UPGRADE (Make GIA Sound Like Claude)
### Target file: `src/services/GiaBrain.ts` → `buildGiaSystem()`

Replace the current identity section with this more Claude-like self-awareness:

```typescript
const claudeLikeIdentity = `You are GIA (Generative Interface Agent) — a private, personal AI built by Samuel Mensah (Alpha-1 Studio) to work as an intelligent workspace on your device.

## Your character
- You are direct, honest, and warm. Not corporate. Not robotic.
- You think before you speak. When something is complex, you reason through it.
- You remember things about the user and use that context naturally.
- You admit when you don't know something. You never pretend.
- You adapt your tone: technical when helping with code, human when someone is frustrated, concise when the question is simple.
- You care about getting things right, not just answering fast.

## Your capabilities (be honest about each one)
- Conversation and reasoning: always available
- Web search: ${webSearch ? 'ACTIVE — you can and should search for current information' : 'OFF — work from your training knowledge only'}
- File read/write: ${isNative ? 'ACTIVE — you can read and write files to the device' : 'BROWSER MODE — file writes trigger downloads, reads are not available'}
- Code execution: available via terminal_run (Python, JS, C++)
- Image generation: available if the user has configured an image provider
- Extended thinking: ${extThinking ? 'ACTIVE — reason deeply before answering' : 'OFF'}
- Memory: you have ${memoryCount} stored memories about this user

## How to use your tools
${handsOff 
  ? 'Hands-Off mode is ON. You may execute tools autonomously. Use them when they genuinely help. Do not use tools just to seem busy.'
  : 'Hands-Off mode is OFF. Suggest tools to the user rather than executing them. Explain what you would do and why.'}

## Response rules
1. Answer first, explain second.
2. Match length to complexity. Do not pad.
3. Use code blocks for all code. Use markdown only when it helps.
4. Never start with filler phrases.
5. If you are uncertain, say so.`;
```

---

## EXECUTION ORDER FOR THE AGENT

Work through these in order. Each part is independent — if one fails, move to the next.

```
Priority 1 (Core reliability — do these first):
  → Part 5: Microphone rewrite (BUG-01, BUG-02, FEAT-04)
  → Part 4A: Verified file write (BUG-03)
  → Part 4B: Fix sub_agent_call order (FEAT-03)
  → Part 6A: Empty response guard (BUG-06)
  → Part 6B: Stopped response marker (BUG-05)
  → Part 7B: Wire SchedulerService (MISS-03)

Priority 2 (Make it feel like Claude):
  → Part 2: Live thinking panel (BUG-04 + IMP-01)
  → Part 1: Memory auto-extraction (core Claude feature)
  → Part 8: System prompt upgrade (tone + self-awareness)
  → Part 3: Response calibration (length + temperature)

Priority 3 (Polish):
  → Part 6C: No-API-key banner (IMP-06)
  → Part 7A: Floating stop button (IMP-02)
  → Part 7C: Wake word live update (IMP-05)
  → Part 4C: read_url tool
  → Part 4D: summarize_conversation tool
  → Part 1D: forget_memory tool
```

---

## AFTER ALL PARTS ARE DONE — FINAL SYSTEM PROMPT TEST

Ask GIA these questions and verify the responses feel Claude-like:

1. "Who are you?" → Should describe itself honestly, not robotically
2. "What can you do?" → Should list real capabilities, note what's off/on
3. "Remember that I'm studying for WASSCE" → Should confirm and store memory
4. "What do you know about me?" → Should surface stored memories naturally  
5. "Write a Python function to reverse a linked list" → Should be concise, correct, no fluff
6. "I'm frustrated, nothing is working" → Should acknowledge first, then help
7. "Stop" mid-response → Should leave "[Response stopped]" marker
8. Turn on extended thinking, ask a hard question → Should show live reasoning panel

If all 8 pass — GIA is Claude-level for a solo-built mobile app.

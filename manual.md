# GIA v2.2.2.0 — User Manual

GIA (Generative Interface Agent) is a private, on-device AI workspace for students, developers, and creators.

## Modules

| Module | What it does |
|--------|-------------|
| **Chat** | General AI conversation with web search, extended thinking, file uploads, voice input |
| **Exam** | WASSCE/BECE/JAMB quiz engine with timed exams, study mode, past questions, auto-grading |
| **Analyst** | Data analysis with auto-generated charts (bar, pie, line, table) |
| **Writer** | Draft emails, essays, blog posts, reports, stories, and more |
| **Planner** | Step-by-step plans + recurring scheduled tasks with notifications |
| **Settings** | Profile, memory browser, providers, code endpoint, privacy |

## Features

### Web Search
Tap the **Search** button above the input to enable DuckDuckGo web search. Results are injected into the AI's context. No API key needed.

### Extended Thinking
Tap the **Think** button for step-by-step reasoning before answers. Works with all providers (not just Anthropic).

### Code Execution
Code blocks in responses show a **Run** button. GIA executes via the Piston API (40+ languages). If the code errors, GIA auto-fixes up to 3 times. Set a custom endpoint in **Settings → Code Execution**.

### Voice Input
Tap the mic icon and speak. GIA transcribes and polishes the transcript for clarity.

### Message Actions
**Long-press** (or right-click) any message to show the context menu:
- Copy, Edit, Retry, Continue, Fork, Delete
- Deleted messages can be **Undone** within 5 seconds

### Quick Start Cards
On empty Chat, tap a quick-start card to instantly set up:
- Exam Prep, BECE Prep, Code Help, Summarize URL, Plan My Week

### Memory
GIA automatically extracts key facts from conversations (profile, subjects, scores, weak areas). Browse and edit memories in **Settings → Memory**.

### File Attachments
Attach files (PDF, images, text, code) via the paperclip icon. PDFs are automatically extracted. Images are sent to the AI for analysis.

### Scheduler
In **Planner → Schedule**, set recurring tasks (hourly/daily/weekly). GIA runs the task at the scheduled time and sends a notification with the result preview.

### Exam Mode
- Select exam system: WASSCE, BECE, JAMB, or Custom
- Modes: Study (with explanations), Quiz, Timed Exam, Past Questions
- Subjects and topics are fetched dynamically by AI
- Results are saved and viewable in **Past Results** on the setup screen
- Weak areas are identified and shown after each quiz

### History
View all chat sessions by tapping the history icon (top-left of Chat). Search sessions by title. Create new sessions or delete old ones.

### Notifications
Global notifications appear at the top of the screen and auto-dismiss after 5 seconds.

## Keyboard Shortcuts

- **Enter** — Send message
- **Shift+Enter** — New line (in multiline mode)

## Data & Privacy

- All data stays on your device (IndexedDB/localStorage)
- No backend, no data collection, no accounts
- API keys are stored locally and never sent anywhere except to your chosen provider
- Chats, memories, settings, and exam history persist across sessions

## Provider Setup

1. Go to **Settings → Engine Room**
2. Type the number of your provider (1-6)
3. Enter your API key
4. Select a model

Supported: OpenRouter, Anthropic, OpenAI, Gemini, Groq, OpenCode

## Tips

- Enable **Search** when asking about current events or specific facts
- Use **Think** for math, logic, and complex reasoning
- In Exam Mode, use **Study** mode first for explanations, then **Timed Exam** to test yourself
- Long-press messages instead of using the inline buttons for cleaner UI
- Check **Settings → Memory** to see what GIA remembers about you
- Set a custom code endpoint in Settings if you need persistent packages

---

*Built by Samuel Mensah · Alpha-1 Studio, Ghana*

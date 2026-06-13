/**
 * ProactiveEngine — makes GIA feel alive without an API key
 *
 * Generates time-aware greetings, contextual suggestions, and
 * personality-driven status messages. Works entirely offline.
 */

import LocalLLMService from './LocalLLMService';
import { useGiaStore } from '../store/useGiaStore';

export interface ProactiveMessage {
  text: string;
  emoji: string;
  type: 'greeting' | 'suggestion' | 'status' | 'tip';
}

const MORNING_GREETINGS = [
  { text: "Good morning! The day's fresh and so are you.", emoji: '🌅' },
  { text: 'Morning! Ready to make today productive?', emoji: '☀️' },
  { text: "Hey, early bird! What's on the agenda?", emoji: '🌤' },
];

const AFTERNOON_GREETINGS = [
  { text: "Afternoon! Hope you're having a good one.", emoji: '☀️' },
  { text: 'Hey! Hows your day going so far?', emoji: '✨' },
  { text: "Afternoon check-in: what can I help with?", emoji: '🕐' },
];

const EVENING_GREETINGS = [
  { text: 'Evening! Winding down or grinding?', emoji: '🌆' },
  { text: "Hey! Hope today treated you well.", emoji: '🌙' },
  { text: "Evening — I'm here if you need anything.", emoji: '🌃' },
];

const TIPS = [
  { text: 'Try asking me to summarize a URL', emoji: '📄' },
  { text: 'I can run code — just ask!', emoji: '💻' },
  { text: 'Long-press any message to copy or edit it', emoji: '👆' },
  { text: 'Connect a cloud AI for faster, smarter responses', emoji: '⚡' },
  { text: 'I support math — try $$E = mc^2$$', emoji: '📐' },
  { text: 'You can upload images and I can read them', emoji: '🖼️' },
  { text: 'Need help studying? Try "Quiz me on..."', emoji: '📚' },
  { text: 'I can post to Twitter, LinkedIn, and Facebook', emoji: '📢' },
  { text: 'Try asking me to draw a mermaid diagram', emoji: '📊' },
];

const SUGGESTIONS = [
  { text: 'Set a reminder for something important', emoji: '🔔' },
  { text: 'Take a screenshot', emoji: '📸' },
  { text: 'Search the web for something', emoji: '🌐' },
  { text: 'Read a file from your device', emoji: '📁' },
  { text: 'Connect a new social account', emoji: '🔗' },
];

class ProactiveEngine {
  private lastGreeting = 0;
  private statusInterval?: ReturnType<typeof setInterval>;

  /** Get a time-appropriate greeting */
  getGreeting(): ProactiveMessage {
    const hour = new Date().getHours();
    let pool: { text: string; emoji: string }[];

    if (hour < 12) pool = MORNING_GREETINGS;
    else if (hour < 17) pool = AFTERNOON_GREETINGS;
    else pool = EVENING_GREETINGS;

    const msg = pool[Math.floor(Math.random() * pool.length)];
    return { ...msg, type: 'greeting' };
  }

  /** Get a random tip */
  getTip(): ProactiveMessage {
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    return { ...tip, type: 'tip' };
  }

  /** Get a random suggestion */
  getSuggestion(): ProactiveMessage {
    const sug = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
    return { ...sug, type: 'suggestion' };
  }

  /** Build a personalized welcome message */
  buildWelcomeMessage(): string {
    const store = useGiaStore.getState();
    const name = store.userProfile?.name;
    const greeting = this.getGreeting();

    const localModelLoaded = LocalLLMService.getLoadedModel();

    let lines = `${greeting.emoji} ${greeting.text}\n\n`;

    if (name) {
      lines += `Great to see you again, ${name}! `;
    }

    if (localModelLoaded) {
      lines += `Your local model is ready to go. `;
    } else {
      lines += `I can work offline with on-device AI, or you can connect a cloud provider for more power. `;
    }

    lines += `\n\nWhat would you like to do today?`;

    return lines;
  }

  /** Start periodic status updates (only if no messages yet) */
  startPulse(callback: (msg: ProactiveMessage) => void): void {
    if (this.statusInterval) return;

    // Immediate first greeting
    const greeting = this.getGreeting();
    this.lastGreeting = Date.now();
    callback(greeting);

    // Rotate tips every 3 minutes if idle
    this.statusInterval = setInterval(() => {
      const now = Date.now();
      const idleMinutes = (now - this.lastGreeting) / 60000;
      this.lastGreeting = now;

      if (idleMinutes > 1) {
        // If idle more than a minute, show a tip
        callback(this.getTip());
      } else {
        // Otherwise just a gentle pulse
        const suggestions = this.getSuggestion();
        callback(suggestions);
      }
    }, 180_000); // every 3 minutes

    // Register visibility change to pause/resume
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      } else {
        callback(this.getGreeting());
      }
    });
  }

  stop(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = undefined;
    }
  }
}

export default new ProactiveEngine();

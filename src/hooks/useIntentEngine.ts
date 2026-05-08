// Intent engine removed - was causing intrusive suggestion popups
// Kept as stub to avoid breaking any lingering imports
export const useIntentEngine = () => ({
  suggestion: null,
  onTyping: () => {},
  onSubmit: () => {},
  onResponse: () => {},
  acceptSuggestion: () => {},
  dismissSuggestion: () => {},
});

/**
 * Two parts of the app react to a native wake word detection: the voice
 * control hook (while the user has "Listen" on) and the app-wide background
 * handler in App.tsx. If both reacted they would start two speech recognizers
 * on one microphone, so the hook claims ownership while it is attached.
 */
let owners = 0;

export function claimWakeWord(): () => void {
  owners++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owners = Math.max(0, owners - 1);
  };
}

export function wakeWordIsClaimed(): boolean {
  return owners > 0;
}

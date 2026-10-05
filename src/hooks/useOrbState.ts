import { useEffect, useState } from 'react';
import { useGiaStore } from '../store/useGiaStore';
import ttsService from '../services/TTSService';
import { deriveOrbState, type OrbState } from '../utils/orbState';

/** Live orb state from the voice, speech, tool and thinking state the app already tracks. */
export function useOrbState(): OrbState {
  const voiceState = useGiaStore(s => s.voiceState);
  const currentTool = useGiaStore(s => s.currentTool);
  const thinkingPhase = useGiaStore(s => s.thinkingPhase);
  const [speaking, setSpeaking] = useState(() => ttsService.isSpeaking());

  useEffect(() => {
    setSpeaking(ttsService.isSpeaking());
    return ttsService.onSpeakingChange(setSpeaking);
  }, []);

  return deriveOrbState({ voiceState, speaking, currentTool, thinkingPhase });
}

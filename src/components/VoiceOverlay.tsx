import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Loader2, CheckCircle2 } from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';

const STATE_COLORS = {
  listening: '#a855f7',
  processing: '#f59e0b',
  done: '#22c55e',
  idle: '#a855f7',
} as const;

type VoiceState = keyof typeof STATE_COLORS;

const STATE_LABELS: Record<VoiceState, string> = {
  listening: 'Listening...',
  processing: 'Thinking...',
  done: 'Got it',
  idle: '',
};

const RING_COUNT = 4;
const BAR_COUNT = 52;

// Pre-compute initial bar heights with a natural curve
function buildBarHeights(): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const center = BAR_COUNT / 2;
    const dist = Math.abs(i - center) / center;
    const base = 8 + Math.sin((i / BAR_COUNT) * Math.PI * 6) * 6;
    return Math.max(6, Math.round(base * (1 - dist * 0.4)));
  });
}

const RippleRing: React.FC<{ delay: number; color: string }> = ({ delay, color }) => (
  <motion.div
    className="absolute inset-0 rounded-full"
    style={{
      border: '1.5px solid transparent',
      backgroundImage: `radial-gradient(circle at center, ${color}00 50%, ${color}22 70%, ${color}00 100%)`,
      WebkitMaskImage: 'radial-gradient(circle at center, black 40%, transparent 60%)',
      maskImage: 'radial-gradient(circle at center, black 40%, transparent 60%)',
    }}
    initial={{ scale: 0.3, opacity: 0.6 }}
    animate={{
      scale: [0.3, 1.8, 0.3],
      opacity: [0.5, 0, 0.5],
    }}
    transition={{
      duration: 2.4 + delay * 0.3,
      repeat: Infinity,
      ease: [0.25, 0.1, 0.25, 1],
      delay: delay * 0.4,
    }}
  />
);

export const VoiceOverlay: React.FC = () => {
  const voiceOverlay = useGiaStore(s => s.voiceOverlay);
  const setVoiceOverlay = useGiaStore(s => s.setVoiceOverlay);
  const [barHeights] = useState(buildBarHeights);
  const barsRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  const state = voiceOverlay.state as VoiceState;
  const color = STATE_COLORS[state] || STATE_COLORS.listening;

  // Smooth waveform animation loop
  useEffect(() => {
    if (state !== 'listening' || !barsRef.current) return;
    const bars = barsRef.current.querySelectorAll<HTMLElement>('.vw-bar');
    timeRef.current = 0;

    const animate = () => {
      timeRef.current += 0.03;
      const tVal = timeRef.current;
      bars.forEach((bar, i) => {
        const center = BAR_COUNT / 2;
        const dist = Math.abs(i - center) / center;
        const wave1 = Math.sin(tVal * 3 + i * 0.35) * 14;
        const wave2 = Math.sin(tVal * 1.7 + i * 0.2) * 8;
        const wave3 = Math.sin(tVal * 5 + i * 0.5) * 4;
        const base = barHeights[i] || 12;
        const h = Math.max(4, base + wave1 + wave2 + wave3);
        const falloff = 1 - dist * 0.35;
        bar.style.height = `${h * falloff}px`;
        bar.style.opacity = `${0.35 + (h / 50) * 0.5 * falloff}`;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, barHeights]);

  // Auto-dismiss on done
  useEffect(() => {
    if (state === 'done') {
      setTimeout(() => setVoiceOverlay({ visible: false, state: 'idle', transcript: '' }), 1400);
      return () => clearTimeout(t);
    }
  }, [state, setVoiceOverlay]);

  // Dismiss on Escape
  useEffect(() => {
    if (!voiceOverlay.visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVoiceOverlay({ visible: false, state: 'idle', transcript: '' });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [voiceOverlay.visible, setVoiceOverlay]);

  const dismiss = useCallback(() => {
    setVoiceOverlay({ visible: false, state: 'idle', transcript: '' });
  }, [setVoiceOverlay]);

  const iconMap: Record<string, React.ReactNode> = {
    processing: <Loader2 size={32} className="text-amber-400 animate-spin" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' }} />,
    done: <CheckCircle2 size={32} className="text-emerald-400" style={{ filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.5))' }} />,
  };
  const currentIcon = iconMap[state] || <Mic size={32} style={{ color, filter: `drop-shadow(0 0 8px ${color}66)` }} />;

  return (
    <AnimatePresence>
      {voiceOverlay.visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-[70] flex items-center justify-center select-none overflow-hidden"
          style={{ background: 'rgba(2,2,8,0.92)', backdropFilter: 'blur(48px)', WebkitBackdropFilter: 'blur(48px)' }}
          onClick={dismiss}
        >
          {/* Ambient gradient that shifts with state */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              background: [
                `radial-gradient(ellipse at 50% 40%, ${color}18 0%, transparent 60%)`,
                `radial-gradient(ellipse at 50% 40%, ${color}22 0%, transparent 60%)`,
                `radial-gradient(ellipse at 50% 40%, ${color}18 0%, transparent 60%)`,
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Subtle floating particles */}
          {state === 'listening' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 1.5 + (i % 3) * 0.5,
                    height: 1.5 + (i % 3) * 0.5,
                    background: color,
                    opacity: 0.15 + (i % 5) * 0.05,
                    left: `${10 + (i * 17) % 80}%`,
                    top: `${20 + (i * 13) % 60}%`,
                  }}
                  animate={{
                    y: [0, -30 - (i % 20) * 2, 0],
                    x: [0, (i % 2 === 0 ? 1 : -1) * (5 + (i % 15))],
                    opacity: [0.1, 0.3, 0.1],
                  }}
                  transition={{
                    duration: 3 + (i % 5) * 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.4,
                  }}
                />
              ))}
            </div>
          )}

          {/* Main content */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.8 }}
            className="flex flex-col items-center gap-8 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Animated rings + mic */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              {/* Outer ripples — only during listening */}
              {state === 'listening' && (
                <>
                  {Array.from({ length: RING_COUNT }).map((_, i) => (
                    <RippleRing key={i} delay={i} color={color} />
                  ))}
                  {/* Extra ambient glow ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle at center, ${color}11, transparent 70%)`,
                    }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </>
              )}

              {/* Processing ring */}
              {state === 'processing' && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: `2px solid ${color}33`,
                    borderTopColor: color,
                    borderRightColor: color,
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              )}

              {/* Done ring */}
              {state === 'done' && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ border: `2px solid ${color}44` }}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: [0.8, 1.1, 1], opacity: [0, 0.5, 0] }}
                  transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                />
              )}

              {/* Center mic icon */}
              <motion.div
                className="w-28 h-28 rounded-full flex items-center justify-center relative z-10"
                style={{
                  background: `radial-gradient(circle at 40% 35%, ${color}33, ${color}08 70%, transparent)`,
                }}
                animate={
                  state === 'listening'
                    ? {
                        scale: [1, 1.03, 1],
                        boxShadow: [
                          `0 0 30px ${color}33, inset 0 0 30px ${color}11`,
                          `0 0 60px ${color}55, inset 0 0 50px ${color}22`,
                          `0 0 30px ${color}33, inset 0 0 30px ${color}11`,
                        ],
                      }
                    : state === 'done'
                    ? {
                        boxShadow: [
                          `0 0 40px ${color}44, inset 0 0 20px ${color}22`,
                          `0 0 20px ${color}22, inset 0 0 10px ${color}11`,
                        ],
                      }
                    : {
                        boxShadow: [
                          `0 0 20px ${color}22, inset 0 0 20px ${color}11`,
                          `0 0 40px ${color}44, inset 0 0 30px ${color}22`,
                          `0 0 20px ${color}22, inset 0 0 20px ${color}11`,
                        ],
                      }
                }
                transition={
                  state === 'listening'
                    ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                    : state === 'processing'
                    ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }
                }
              >
                <motion.div
                  key={state}
                  initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.6, opacity: 0, rotate: 20 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                >
                  {currentIcon}
                </motion.div>
              </motion.div>
            </div>

            {/* State label with character animation */}
            <div className="h-6 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={state}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: 'spring', stiffness: 150, damping: 16 }}
                  className="text-sm font-semibold tracking-[0.15em] uppercase"
                  style={{ color, textShadow: `0 0 20px ${color}44` }}
                >
                  {STATE_LABELS[state] || ''}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Transcript card */}
            <AnimatePresence mode="wait">
              {voiceOverlay.transcript && (
                <motion.div
                  key={voiceOverlay.transcript + state}
                  initial={{ opacity: 0, y: 12, scale: 0.95, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -12, scale: 0.95, filter: 'blur(4px)' }}
                  transition={{ type: 'spring', stiffness: 120, damping: 15, mass: 0.8 }}
                  className="px-7 py-4 rounded-2xl max-w-sm w-[90vw] mx-auto text-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: `0 4px 32px rgba(0,0,0,0.3)`,
                  }}
                >
                  <p className="text-sm text-zinc-300/80 leading-relaxed font-[450]">
                    "{voiceOverlay.transcript}"
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Waveform */}
            {state === 'listening' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <div
                  ref={barsRef}
                  className="flex items-end gap-[2.5px] h-[52px] px-4"
                  style={{ filter: `drop-shadow(0 0 6px ${color}22)` }}
                >
                  {Array.from({ length: BAR_COUNT }).map((_, i) => (
                    <div
                      key={i}
                      className="vw-bar rounded-full"
                      style={{
                        width: '3px',
                        height: `${barHeights[i]}px`,
                        background: `linear-gradient(to top, ${color}88, ${color})`,
                        opacity: 0.5,
                        willChange: 'height, opacity',
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Subtle hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-[9px] text-zinc-600 tracking-[0.2em] uppercase"
            >
              Tap or press Esc to close
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

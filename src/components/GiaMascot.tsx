import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

type MascotAction = 'idle' | 'lookDown' | 'lookUp' | 'tiltLeft' | 'tiltRight' | 'spin' | 'driftLeft' | 'driftRight';

const GiaMascot: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !prefersReducedMotion;
  const [action, setAction] = React.useState<MascotAction>('idle');
  const spinCount = React.useRef(0);

  React.useEffect(() => {
    if (!shouldAnimate) {
      setAction('idle');
      return;
    }

    let actionTimer: ReturnType<typeof setTimeout>;
    let restTimer: ReturnType<typeof setTimeout>;
    let previousAction: MascotAction = 'idle';
    const actions: MascotAction[] = [
      'lookDown', 'lookUp', 'tiltLeft', 'tiltRight',
      'driftLeft', 'driftRight', 'lookDown', 'tiltRight', 'spin',
    ];

    const scheduleNext = () => {
      restTimer = setTimeout(() => {
        const options = actions.filter((candidate) => candidate !== previousAction);
        const next = options[Math.floor(Math.random() * options.length)];
        const duration = next === 'spin' ? 900 : 650 + Math.random() * 550;
        if (next === 'spin') spinCount.current += 1;
        previousAction = next;
        setAction(next);
        actionTimer = setTimeout(() => {
          setAction('idle');
          scheduleNext();
        }, duration);
      }, 900 + Math.random() * 2100);
    };

    scheduleNext();
    return () => {
      clearTimeout(restTimer);
      clearTimeout(actionTimer);
    };
  }, [shouldAnimate]);

  const rotation = spinCount.current * 360;
  const movement = {
    idle: { x: 0, y: 0, rotate: 0 },
    lookDown: { x: 0, y: 2, rotate: rotation },
    lookUp: { x: 0, y: -1, rotate: rotation },
    tiltLeft: { x: -2, y: 0, rotate: rotation - 5 },
    tiltRight: { x: 2, y: 0, rotate: rotation + 5 },
    spin: { x: 0, y: -2, rotate: rotation },
    driftLeft: { x: -5, y: -2, rotate: rotation - 2 },
    driftRight: { x: 5, y: -2, rotate: rotation + 2 },
  } satisfies Record<MascotAction, { x: number; y: number; rotate: number }>;
  movement.idle.rotate = rotation;

  return (
    <div
      role="img"
      aria-label="GIA mascot, a friendly robot sitting on a glowing orb"
      className="w-28 h-28"
    >
      <svg viewBox="0 0 120 120" className="w-full h-full" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="gia-mascot-orb" cx="35%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="42%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#4c1d95" />
          </radialGradient>
          <linearGradient id="gia-mascot-metal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5f3ff" />
            <stop offset="45%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="gia-mascot-body" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ddd6fe" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="gia-mascot-face" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#252044" />
            <stop offset="100%" stopColor="#111126" />
          </linearGradient>
          <filter id="gia-mascot-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        <motion.ellipse
          cx="60" cy="105" rx="31" ry="7" fill="#8b5cf6" filter="url(#gia-mascot-glow)"
          animate={shouldAnimate ? { opacity: [0.12, 0.25, 0.12], scaleX: [0.96, 1.04, 0.96] } : { opacity: 0.18 }}
          transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.circle
          cx="60" cy="88" r="25" fill="#a78bfa" filter="url(#gia-mascot-glow)"
          animate={shouldAnimate ? { opacity: [0.12, 0.28, 0.12], scale: [0.96, 1.05, 0.96] } : { opacity: 0.17 }}
          transition={{ duration: 2.8, ease: 'easeInOut', repeat: Infinity }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <circle cx="60" cy="87" r="22" fill="url(#gia-mascot-orb)" stroke="#c4b5fd" strokeOpacity="0.55" strokeWidth="1.2" />
        <ellipse cx="60" cy="88" rx="31" ry="9" stroke="#c4b5fd" strokeOpacity="0.55" strokeWidth="1.2" />
        <path d="M45 95c8 5 22 5 30 0" stroke="#ddd6fe" strokeOpacity="0.5" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="51" cy="77" r="2" fill="#e9d5ff" />
        <circle cx="69" cy="77" r="2" fill="#e9d5ff" />

        <motion.g
          animate={shouldAnimate ? movement[action] : movement.idle}
          transition={{ duration: action === 'spin' ? 0.9 : 0.65, ease: 'easeInOut' }}
          style={{ transformBox: 'view-box', transformOrigin: '60px 48px' }}
        >
        <path d="M53 65c-7 2-10 8-8 13 1 4 7 6 13 4l4-11-9-6Z" fill="url(#gia-mascot-body)" stroke="#ede9fe" strokeOpacity="0.7" strokeWidth="1" />
        <path d="M67 65c7 2 10 8 8 13-1 4-7 6-13 4l-4-11 9-6Z" fill="url(#gia-mascot-body)" stroke="#ede9fe" strokeOpacity="0.7" strokeWidth="1" />
        <path d="M46 75c-2 4 0 7 4 8l8 1c3 0 4-4 2-6l-6-5-8 2Z" fill="#c4b5fd" />
        <path d="M74 75c2 4 0 7-4 8l-8 1c-3 0-4-4-2-6l6-5 8 2Z" fill="#a78bfa" />
        <path d="M44 57c-5 1-8 5-8 10 0 3 3 4 5 2l8-7-5-5Z" fill="url(#gia-mascot-metal)" stroke="#ede9fe" strokeOpacity="0.55" strokeWidth="1" />
        <path d="M76 57c5 1 8 5 8 10 0 3-3 4-5 2l-8-7 5-5Z" fill="url(#gia-mascot-metal)" stroke="#ede9fe" strokeOpacity="0.55" strokeWidth="1" />
        <rect x="46" y="50" width="28" height="25" rx="9" fill="url(#gia-mascot-body)" stroke="#ede9fe" strokeOpacity="0.75" strokeWidth="1.2" />
        <path d="M51 55c4-3 12-4 18 0" stroke="#fff" strokeOpacity="0.38" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="60" cy="64" r="5" fill="#22d3ee" opacity="0.15" />
        <motion.circle
          cx="60" cy="64" r="2.5" fill="#67e8f9"
          animate={shouldAnimate ? { opacity: [0.65, 1, 0.65], scale: [0.9, 1.15, 0.9] } : undefined}
          transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />

        <path d="M60 22v-5" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round" />
        <motion.circle
          cx="60" cy="14" r="3.5" fill="#67e8f9" stroke="#e0f2fe" strokeWidth="1"
          animate={shouldAnimate ? { scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] } : undefined}
          transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <motion.g
          animate={shouldAnimate ? {
            rotate: action === 'tiltLeft' ? -15 : action === 'tiltRight' ? 15 : action === 'lookDown' ? 8 : action === 'lookUp' ? -6 : 0,
          } : undefined}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ transformBox: 'view-box', transformOrigin: '60px 50px' }}
        >
        <rect x="40" y="20" width="40" height="35" rx="13" fill="url(#gia-mascot-metal)" stroke="#f5f3ff" strokeWidth="1.3" />
        <path d="M47 26c6-4 20-4 26 0" stroke="#fff" strokeOpacity="0.65" strokeWidth="2" strokeLinecap="round" />
        <rect x="45" y="28" width="30" height="19" rx="8" fill="url(#gia-mascot-face)" />
        <motion.g
          animate={shouldAnimate ? {
            x: action === 'driftLeft' || action === 'tiltLeft' ? -1.2 : action === 'driftRight' || action === 'tiltRight' ? 1.2 : 0,
            y: action === 'lookDown' ? 1.3 : action === 'lookUp' ? -0.8 : 0,
          } : undefined}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <motion.circle
            cx="54" cy="37" r="2.3" fill="#67e8f9"
            animate={shouldAnimate ? { scaleY: [1, 1, 0.08, 1, 1] } : undefined}
            transition={{ duration: 4.2, times: [0, 0.82, 0.86, 0.9, 1], repeat: Infinity, ease: 'linear' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
          <motion.circle
            cx="66" cy="37" r="2.3" fill="#67e8f9"
            animate={shouldAnimate ? { scaleY: [1, 1, 0.08, 1, 1] } : undefined}
            transition={{ duration: 4.2, times: [0, 0.82, 0.86, 0.9, 1], repeat: Infinity, ease: 'linear', delay: 0.04 }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </motion.g>
        <path d="M56 42c2 2 6 2 8 0" stroke="#a5f3fc" strokeWidth="1.3" strokeLinecap="round" />
        <rect x="36" y="32" width="5" height="11" rx="2.5" fill="#a78bfa" stroke="#ddd6fe" strokeWidth="0.8" />
        <rect x="79" y="32" width="5" height="11" rx="2.5" fill="#8b5cf6" stroke="#ddd6fe" strokeWidth="0.8" />
        </motion.g>
        </motion.g>

        <path d="m31 44 1.5 3.5L36 49l-3.5 1.5L31 54l-1.5-3.5L26 49l3.5-1.5L31 44Z" fill="#c4b5fd" opacity="0.8" />
        <path d="m89 54 1.2 2.8L93 58l-2.8 1.2L89 62l-1.2-2.8L85 58l2.8-1.2L89 54Z" fill="#67e8f9" opacity="0.8" />
      </svg>
    </div>
  );
};

export default GiaMascot;

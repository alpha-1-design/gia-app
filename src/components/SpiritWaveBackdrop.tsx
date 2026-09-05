import React from 'react';
import spiritBeingBg from '../assets/images/spirit_waves_being.jpg';

interface SpiritWaveBackdropProps {
  intensity?: 'subtle' | 'vivid';
}

export const SpiritWaveBackdrop: React.FC<SpiritWaveBackdropProps> = ({
  intensity = 'vivid',
}) => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0 bg-black">
      {/* Primary Being & Spiritual Energy Background Image */}
      <div className="absolute inset-0 w-full h-full">
        <img
          src={spiritBeingBg}
          alt="Spirit Entity and Waves"
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover object-center ${intensity === 'subtle' ? 'opacity-65' : 'opacity-85'} scale-[1.01] transition-all duration-700`}
          style={{
            filter: intensity === 'subtle' ? 'contrast(1.15) brightness(0.85)' : 'contrast(1.3) brightness(0.92)',
          }}
        />
      </div>

      {/* Thick pitch-black radial vignette: focuses on center being while darkening borders into pure void */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(0, 0, 0, 0.15) 0%, rgba(3, 3, 7, 0.55) 50%, rgba(0, 0, 0, 0.95) 85%, #000000 100%)',
        }}
      />

      {/* Top & Bottom Depth Vignettes */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-black/90 via-transparent to-black" />
      <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-black via-transparent to-black/60" />

      {/* Luminous Animated Spirit Waves (SVG Ribbons) */}
      <div className="absolute inset-0 w-full h-full overflow-hidden opacity-60">
        <svg
          className="absolute w-[200%] h-full -left-1/2 top-0 animate-[pulse_6s_ease-in-out_infinite]"
          viewBox="0 0 1440 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0,320 C320,180 480,440 800,280 C1120,120 1280,360 1440,240"
            stroke="url(#spirit-wave-1)"
            strokeWidth="2"
            strokeOpacity="0.7"
            fill="none"
          />
          <path
            d="M0,260 C280,380 560,160 880,320 C1200,480 1360,200 1440,280"
            stroke="url(#spirit-wave-2)"
            strokeWidth="1.5"
            strokeOpacity="0.5"
            strokeDasharray="6 8"
            fill="none"
          />
          <path
            d="M0,380 C360,240 640,460 960,300 C1280,140 1380,400 1440,340"
            stroke="url(#spirit-wave-3)"
            strokeWidth="2.5"
            strokeOpacity="0.4"
            fill="none"
          />
          <defs>
            <linearGradient id="spirit-wave-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0" />
              <stop offset="25%" stopColor="#a855f7" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="75%" stopColor="#c084fc" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="spirit-wave-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="35%" stopColor="#818cf8" stopOpacity="0.7" />
              <stop offset="70%" stopColor="#a855f7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="spirit-wave-3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
              <stop offset="50%" stopColor="#ec4899" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Floating spiritual light motes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-1.5 h-1.5 rounded-full bg-purple-300 shadow-[0_0_12px_#a855f7] animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_16px_#38bdf8] animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 rounded-full bg-indigo-300 shadow-[0_0_8px_#818cf8] animate-ping" style={{ animationDuration: '5s' }} />
        <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 rounded-full bg-violet-200 shadow-[0_0_14px_#c084fc] animate-pulse" style={{ animationDuration: '4.5s' }} />
      </div>

      {/* Subtle pulse aura behind center */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] rounded-full pointer-events-none blur-3xl opacity-25"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, rgba(99,102,241,0.2) 40%, transparent 70%)',
        }}
      />
    </div>
  );
};

export default SpiritWaveBackdrop;

import React from 'react';

/**
 * A quieter, smaller sibling of SpiritWaveBackdrop for the "no provider
 * connected" empty state in the main chat. Same visual language (purple/
 * violet gradients, soft glow, animated wave ribbons) but the wave itself
 * is shaped into a horse head/neck silhouette instead of the full-screen
 * being artwork — this is a background accent behind existing content, not
 * a full-bleed takeover, so it stays low-opacity and doesn't fight with the
 * text/buttons in front of it.
 */
export const HorseSpiritBackdrop: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* Soft glow aura behind the silhouette */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full blur-3xl opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.35) 0%, rgba(99,102,241,0.15) 45%, transparent 70%)' }}
      />

      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[260px] opacity-[0.12]"
        viewBox="0 0 320 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M215,45
             C205,55 190,68 175,85
             C155,108 135,132 118,155
             C105,172 94,184 82,191
             C74,196 65,198 58,198
             C68,206 78,211 90,213
             C100,215 108,215 118,212
             C138,210 158,214 173,222
             C183,228 190,234 194,242
             C200,255 203,268 204,280
             C205,290 206,296 208,300
             L262,296
             C266,278 268,262 267,245
             C266,225 260,206 250,188
             C240,170 228,152 218,133
             C210,117 206,100 206,82
             C206,70 208,58 215,45 Z"
          fill="url(#horse-body-gradient)"
        />
        <path
          d="M209,50 C207,34 206,20 209,7 C213,17 217,28 219,40 C217,44 213,48 209,50 Z"
          fill="url(#horse-body-gradient)"
        />
        <path
          d="M224,54 C224,38 226,24 231,11 C234,21 236,33 236,45 C232,49 228,52 224,54 Z"
          fill="url(#horse-body-gradient)"
        />
        {/* Flowing mane along the neck crest -- the "wave" part of the wave-horse */}
        <path
          d="M206,82 C214,100 222,118 232,136 C242,154 252,172 260,192"
          stroke="url(#horse-mane-gradient-1)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          className="animate-[pulse_5s_ease-in-out_infinite]"
        />
        <path
          d="M200,95 C210,112 220,130 230,148 C240,166 248,184 254,204"
          stroke="url(#horse-mane-gradient-2)"
          strokeWidth="2"
          strokeDasharray="4 6"
          fill="none"
          strokeLinecap="round"
          className="animate-[pulse_4s_ease-in-out_infinite]"
          style={{ animationDelay: '0.5s' }}
        />
        <defs>
          <linearGradient id="horse-body-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="horse-mane-gradient-1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" stopOpacity="0" />
            <stop offset="50%" stopColor="#c084fc" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="horse-mane-gradient-2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* A couple of floating motes, matching SpiritWaveBackdrop's language */}
      <div className="absolute top-[30%] left-[35%] w-1 h-1 rounded-full bg-purple-300 shadow-[0_0_10px_#a855f7] animate-ping" style={{ animationDuration: '4s' }} />
      <div className="absolute top-[60%] right-[30%] w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#38bdf8] animate-pulse" style={{ animationDuration: '3.5s' }} />
    </div>
  );
};

export default HorseSpiritBackdrop;

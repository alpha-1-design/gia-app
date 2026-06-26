import React from 'react';
import { motion } from 'motion/react';
import { AnimatedCharacter } from './AnimatedCharacter';
import { ArrowRight, Sparkles, Github, Smartphone, Shield, Cpu, Download } from 'lucide-react';

const FloatingTaglines: React.FC = () => {
  const taglines = [
    'Private AI Workspace',
    'Zero Backend Required',
    '100% On-Device',
    'No Telemetry Ever',
    'Your Data Stays Yours',
  ];
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % taglines.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-8 overflow-hidden relative">
      <motion.div
        key={index}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="text-zinc-500 text-sm"
      >
        {taglines[index]}
      </motion.div>
    </div>
  );
};

export const Hero: React.FC = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0a0a0f]">
      <div className="absolute inset-0">
        <div className="absolute top-1/5 left-1/4 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/5 w-[400px] h-[400px] bg-purple-700/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/3 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: [
              'linear-gradient(rgba(168,85,247,0.3) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(168,85,247,0.3) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute inset-0 opacity-[0.4]" style={{
          background: 'radial-gradient(ellipse at 20% 50%, rgba(168,85,247,0.03) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(124,58,237,0.03) 0%, transparent 50%)',
        }} />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-28 pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-10">
          <div className="flex-1 text-center lg:text-left max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-semibold mb-5 tracking-widest uppercase">
                <Sparkles size={12} />
                v2.3.1 — Now Available
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-tight mb-4"
            >
              <span className="text-white">Your Personal</span>
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
                AI Interface Agent
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <FloatingTaglines />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-base sm:text-lg text-zinc-400 mt-4 mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0"
            >
              Private, on-device AI workspace. No backend, no telemetry, no cloud dependency.
              Connect your own AI provider and stay in control.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start"
            >
              <a
                href="#getting-started"
                onClick={(e) => { e.preventDefault(); scrollTo('getting-started'); }}
                className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-600/20 hover:shadow-violet-500/40 cursor-pointer overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started Free
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a
                href="#showcases"
                onClick={(e) => { e.preventDefault(); scrollTo('showcases'); }}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 font-medium text-sm border border-zinc-700/40 transition-all cursor-pointer"
              >
                See Showcases
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex flex-wrap items-center gap-5 mt-8 justify-center lg:justify-start"
            >
              <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                <Smartphone size={14} className="text-violet-500" />
                Android + Web
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                <Shield size={14} className="text-violet-500" />
                No Telemetry
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                <Cpu size={14} className="text-violet-500" />
                18+ Providers
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <a
                href="https://github.com/alpha-1-design/gia-app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-violet-400 transition-colors"
              >
                <Github size={14} />
                Open Source
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="flex-1 flex justify-center lg:justify-end"
          >
            <AnimatedCharacter className="scale-[1.6] lg:scale-[1.8]" />
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-1.5 cursor-pointer"
          onClick={() => document.getElementById('stats')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="text-[9px] text-zinc-700 tracking-widest uppercase font-medium">Scroll</span>
          <div className="w-[18px] h-[30px] rounded-full border border-zinc-700 flex items-start justify-center p-[5px]">
            <div className="w-[2.5px] h-[6px] rounded-full bg-violet-500" />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

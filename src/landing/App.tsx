import React from 'react';
import { Hero } from './components/Hero';
import { Stats } from './components/Stats';
import { MockUI } from './components/MockUI';
import { Showcases } from './components/Showcases';
import { Skills } from './components/Skills';
import { Connectors } from './components/Connectors';
import { GettingStarted } from './components/GettingStarted';
import { Footer } from './components/Footer';
import './landing.css';

const Nav: React.FC = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-zinc-800/40">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
            style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
          >
            G
          </div>
          <span className="text-sm font-bold text-white tracking-tight">GIA</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-[11px] text-zinc-500">
          <button onClick={() => scrollTo('showcases')} className="hover:text-white transition-colors cursor-pointer font-medium">Showcases</button>
          <button onClick={() => scrollTo('skills')} className="hover:text-white transition-colors cursor-pointer font-medium">Skills</button>
          <button onClick={() => scrollTo('connectors')} className="hover:text-white transition-colors cursor-pointer font-medium">Connectors</button>
          <button onClick={() => scrollTo('getting-started')} className="hover:text-white transition-colors cursor-pointer font-medium">Get Started</button>
          <a
            href="https://github.com/alpha-1-design/gia-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 transition-all font-semibold"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>

        <div className="md:hidden">
          <a
            href="https://github.com/alpha-1-design/gia-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/10 text-violet-400 text-[11px] font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-['DM_Sans',system-ui,sans-serif]">
      <Nav />
      <Hero />
      <Stats />
      <MockUI />
      <Showcases />
      <Skills />
      <Connectors />
      <GettingStarted />
      <Footer />
    </div>
  );
};

export default App;
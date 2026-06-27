import React from 'react';
import { Github, Heart, Twitter, Linkedin, Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="relative py-16 bg-[#08080c] border-t border-zinc-800/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid sm:grid-cols-3 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
              >
                G
              </div>
              <span className="text-sm font-bold text-white">GIA</span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-xs">
              Generative Interface Agent — Private, on-device AI workspace. No backend, no telemetry, no cloud dependency.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Links</h4>
            <div className="space-y-2 text-xs">
              <a href="https://github.com/alpha-1-design/gia-app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors"><Github size={12} />GitHub Repository</a>
              <a href="https://github.com/alpha-1-design/gia-app/releases" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors"><Twitter size={12} />Releases & APK</a>
              <a href="https://github.com/alpha-1-design/gia-app/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors"><Mail size={12} />Apache 2.0 License</a>
              <a href="https://github.com/alpha-1-design/gia-app/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors"><Linkedin size={12} />Contributing</a>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Built By</h4>
            <div className="space-y-2 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <Heart size={10} className="text-red-500" />
                <span>Samuel Mensah</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={10} />
                <span>alphariansamuel@gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Twitter size={10} />
                <span>Alpha-1 Studio, Ghana</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-zinc-700">
            GIA v2.3.1 · © 2026 Samuel Mensah · Alpha-1 Studio, Ghana
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span>Open Source</span>
            <Github size={11} className="text-zinc-500" />
            <span>Apache 2.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
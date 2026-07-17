import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { OnDevice } from './components/OnDevice'
import { Modules } from './components/Modules'
import { HowItWorks } from './components/HowItWorks'
import { UseCases } from './components/UseCases'
import { Skills } from './components/Skills'
import { Comparison } from './components/Comparison'
import { Docs } from './components/Docs'
import { FAQ } from './components/FAQ'
import { Stats } from './components/Stats'
import { CTA } from './components/CTA'
import { Footer } from './components/Footer'
import './landing.css'

const navItems = [
  { label: 'Features', href: '#features' },
  { label: 'On-Device', href: '#on-device' },
  { label: 'App', href: '#app' },
  { label: 'How', href: '#how' },
  { label: 'Use Cases', href: '#usecases' },
  { label: 'Compare', href: '#compare' },
  { label: 'Docs', href: '#docs' },
  { label: 'Skills', href: '#skills' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Stats', href: '#stats' },
]

export default function App() {
  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans antialiased">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050508]/70 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-violet-500/20">
              G
            </div>
            <span className="text-sm font-semibold tracking-tight">GIA</span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors font-medium"
              >
                {item.label}
              </a>
            ))}
            <a
              href="https://github.com/alpha-1-design/gia-app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-sm font-medium text-zinc-300 hover:text-white transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub
            </a>
            <a
              href="https://github.com/alpha-1-design/gia-app/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all"
            >
              Download
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </a>
          </div>
        </div>
      </nav>

      <Hero />
      <Features />
      <OnDevice />
      <Modules />
      <HowItWorks />
      <UseCases />
      <Comparison />
      <Docs />
      <Skills />
      <FAQ />
      <Stats />
      <CTA />
      <Footer />
    </div>
  )
}

import { Github, Heart, Monitor, Smartphone } from 'lucide-react'

const links = [
  { label: 'gia-app (Phone)', href: 'https://github.com/alpha-1-design/gia-app' },
  { label: 'gia-cowork (Desktop)', href: 'https://github.com/alpha-1-design/gia-cowork' },
  { label: 'Desktop Releases', href: 'https://github.com/alpha-1-design/gia-cowork/releases' },
  { label: 'App Releases', href: 'https://github.com/alpha-1-design/gia-app/releases' },
]

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.04] bg-[#050508]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-[8px] font-bold">
              G
            </div>
            <span className="text-sm font-semibold text-zinc-400">GIA</span>
            <span className="text-xs text-zinc-700 mx-2">—</span>
            <span className="text-xs text-zinc-700">
              &copy; {new Date().getFullYear()} Alpha Studio
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <Smartphone size={12} className="text-violet-400/70" />
              Phone · <Monitor size={12} className="text-cyan-400/70 mx-1" />
              Desktop
            </div>
            {links.map(link => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://github.com/alpha-1-design/gia-app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <Github size={16} />
            </a>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-700">
            Built with
            <Heart size={10} className="text-red-500/60" />
            for privacy
          </div>
        </div>
      </div>
    </footer>
  )
}
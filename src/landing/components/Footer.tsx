import { Github, Heart } from 'lucide-react'

const links = [
  { label: 'GitHub', href: 'https://github.com/alpha-1-design/gia-app' },
  { label: 'Releases', href: 'https://github.com/alpha-1-design/gia-app/releases' },
  { label: 'Issues', href: 'https://github.com/alpha-1-design/gia-app/issues' },
]

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.04] bg-[#050508]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-[8px] font-bold">
              G
            </div>
            <span className="text-sm font-semibold text-zinc-400">GIA</span>
            <span className="text-xs text-zinc-700 mx-2">—</span>
            <span className="text-xs text-zinc-700">
              &copy; {new Date().getFullYear()} Alpha Studio
            </span>
          </div>

          <div className="flex items-center gap-6">
            {links.map(link => (
              <a
                key={link.label}
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

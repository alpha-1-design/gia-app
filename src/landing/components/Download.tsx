import { motion } from 'motion/react'
import { Package, Download as DownloadIcon, ArrowRight, Rocket, Boxes, Terminal, Wifi, RefreshCcw, ExternalLink, ShieldCheck, KeyRound, Smartphone } from 'lucide-react'

const BASE = 'https://github.com/alpha-1-design/gia-cowork/releases/download/v0.1.0'

const packages = [
  {
    name: 'AppImage',
    ext: '.AppImage',
    desc: 'Distro-agnostic single file — works on any modern Linux with FUSE.',
    file: 'GIA.Cowork_0.1.0_amd64.AppImage',
    size: '~150 MB',
    cmd: 'chmod +x GIA.Cowork_0.1.0_amd64.AppImage && ./GIA.Cowork_0.1.0_amd64.AppImage',
    note: 'On first update GIA chmod +x’s the new artifact and relaunches itself in the background.',
    color: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20',
    badge: 'text-cyan-300 bg-cyan-500/10',
  },
  {
    name: 'Debian / Ubuntu',
    ext: '.deb',
    desc: 'For Debian, Ubuntu, Mint, and anything dpkg-based. The focused pick.',
    file: 'GIA.Cowork_0.1.0_amd64.deb',
    size: '~80 MB',
    cmd: 'sudo dpkg -i GIA.Cowork_0.1.0_amd64.deb',
    note: 'Updates are applied with pkexec dpkg -i automatically — no terminal needed after the first install.',
    color: 'from-violet-500/15 to-violet-500/5 border-violet-500/20',
    badge: 'text-violet-300 bg-violet-500/10',
  },
  {
    name: 'Fedora / RHEL / openSUSE',
    ext: '.rpm',
    desc: 'For Fedora, RHEL, Rocky, Alma, openSUSE, and other rpm-based distros.',
    file: 'GIA.Cowork-0.1.0-1.x86_64.rpm',
    size: '~80 MB',
    cmd: 'sudo rpm -Uvh GIA.Cowork-0.1.0-1.x86_64.rpm',
    note: 'Updates are applied with rpm -Uvh the same way — GIA handles the rest automatically.',
    color: 'from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-500/20',
    badge: 'text-fuchsia-300 bg-fuchsia-500/10',
  },
]

const steps = [
  { icon: DownloadIcon, title: 'Download', desc: 'Grab the package for your distro below. The file streams straight from GitHub releases.' },
  { icon: Terminal, title: 'Install', desc: 'Run the one-line command — or just run the AppImage. No daemon setup, no config file.' },
  { icon: Rocket, title: 'Launch', desc: 'GIA boots into your terminal. Close the window and it keeps living in the tray as a daemon.' },
  { icon: Wifi, title: 'Pair the phone', desc: 'Point gia-app at the desktop’s LAN URL with the same pairing id — two devices, one brain.' },
]

const phoneReleaseHighlights = [
  'Phone-first Android experience with native device controls',
  'Secure credential vault with Android Keystore support',
  'Alpine apk and Ubuntu apt-get sandbox provisioning',
  'Termux integration with explicit user approval',
  'Safer workspace file operations and no silent host fallback',
  'Live capability center for providers, permissions, terminal, and device features',
]

export function Download() {
  return (
    <section id="download" className="relative py-28 overflow-hidden bg-[#050508]">
      <div className="absolute inset-0">
        <div className="hero-glow top-1/3 left-1/2 -translate-x-1/2 bg-violet-600 opacity-25" />
        <div className="absolute inset-0 bg-dots opacity-60" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-5 tracking-wider uppercase">
            <Boxes size={12} />
            GIA Desktop · Linux · Released
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
            Download. Install. <span className="aurora-text">The rest handles itself.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            The file is the whole app. Once it’s installed, GIA’s built-in updater checks GitHub
            releases on launch, streams newer builds to <code className="text-violet-400">~/Downloads</code>{' '}
            with a live progress bar, then installs and relaunches itself — no package manager gymnastics.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.03] to-cyan-500/[0.06] p-6 sm:p-8 mb-12"
        >
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/20 text-violet-200 text-[10px] font-bold uppercase tracking-widest mb-4">
                <Smartphone size={12} />
                Phone release · v2.4.0.12
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                A real assistant for your Android device.
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                GIA v2.4.0.12 fixes streaming stalls and the mind map card, and unblocks terminal Full Install
                together. It can ask before sensitive actions, request credentials without exposing
                them in chat, and keep execution inside the configured workspace.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 min-w-0 lg:max-w-xl">
              {phoneReleaseHighlights.map((highlight) => (
                <div key={highlight} className="flex items-start gap-2.5 rounded-xl bg-black/20 border border-white/[0.06] px-3 py-3">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-300" />
                  <span className="text-xs leading-relaxed text-zinc-300">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5"><KeyRound size={13} className="text-amber-300" /> Credentials stay protected</span>
            <span className="text-zinc-700">·</span>
            <span>Android APK available from GitHub Releases</span>
            <a href="https://github.com/alpha-1-design/gia-app/releases" target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:text-violet-200 font-semibold transition-colors">
              View v2.4.0.12 release →
            </a>
          </div>
        </motion.div>

        {/* Package cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-16">
          {packages.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`card-glow relative flex flex-col rounded-2xl border bg-gradient-to-b p-6 ${p.color}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                    <Package size={18} className="text-white/80" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white leading-tight">{p.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{p.ext}</div>
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p.badge}`}>{p.size}</span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed mb-4">{p.desc}</p>

              <div className="bg-[#050508]/70 border border-white/[0.05] rounded-lg px-3 py-2.5 mb-4" style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5 }}>
                <span className="text-emerald-400">$ </span>
                <span className="text-zinc-300 break-all">{p.cmd}</span>
              </div>

              <a
                href={`${BASE}/${p.file}`}
                className="mt-auto group inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-semibold text-white transition-all"
              >
                <DownloadIcon size={14} className="text-violet-400 group-hover:translate-y-0.5 transition-transform" />
                Download {p.name}
                <ExternalLink size={12} className="text-zinc-500" />
              </a>

              <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
                <RefreshCcw size={10} className="inline text-emerald-400/70 mr-1 -mt-0.5" />
                {p.note}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Windows & iOS coming soon */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left mb-16"
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 status-dot shrink-0" />
            <p className="text-sm text-zinc-300">
              <span className="font-semibold">Windows and iOS are in the works.</span>{' '}
              <span className="text-zinc-500">Linux desktop ships today — Android is already live.</span>
            </p>
          </div>
        </motion.div>

        {/* Step strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-8"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.title} className="relative">
                {i < steps.length - 1 && (
                  <ArrowRight size={16} className="hidden lg:block absolute top-5 -right-6 text-zinc-700" />
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center">
                    <s.icon size={16} className="text-violet-300" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-600">STEP {i + 1}</span>
                </div>
                <div className="text-sm font-semibold text-zinc-200 mb-1.5">{s.title}</div>
                <div className="text-xs text-zinc-500 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="text-center text-xs text-zinc-600 mt-10">
          Prefer the phone? Grab the Android APK from{' '}
          <a href="https://github.com/alpha-1-design/gia-app/releases" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
            gia-app releases
          </a>{' '}
          — and pair it with the desktop via Unimind. Full release notes on{' '}
          <a href="https://github.com/alpha-1-design/gia-cowork/releases" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
            GitHub
          </a>
          .
        </p>
      </div>
    </section>
  )
}
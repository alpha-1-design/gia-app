import { motion } from 'motion/react'
import {
  Smartphone,
  Monitor,
  Camera,
  MessageSquare,
  MapPin,
  Terminal,
  FileText,
  Shield,
  Eye,
  Key,
  Lock,
  AudioLines,
  Workflow,
  Cpu,
  Network,
} from 'lucide-react'

const phoneCapabilities = [
  { icon: Camera, label: 'Camera' },
  { icon: MessageSquare, label: 'SMS / WhatsApp' },
  { icon: MapPin, label: 'GPS / location' },
  { icon: Eye, label: 'On-device Whisper' },
  { icon: AudioLines, label: 'Kokoro TTS' },
  { icon: Workflow, label: 'Offline transformers' },
]

const desktopCapabilities = [
  { icon: Terminal, label: 'Full Linux shell' },
  { icon: FileText, label: 'Real filesystem' },
  { icon: Shield, label: 'Sandbox' },
  { icon: Monitor, label: 'Screen awareness' },
  { icon: Cpu, label: 'GPU / NVIDIA' },
  { icon: Cpu, label: '270+ tools' },
]

const steps = [
  {
    num: '01',
    title: 'Same network',
    desc: 'Both devices on the same Wi-Fi or LAN. The phone scans the network automatically.',
  },
  {
    num: '02',
    title: 'Open the relay',
    desc: 'On the desktop: Settings → Mesh → Unimind. Copy the LAN URL and pairing id.',
  },
  {
    num: '03',
    title: 'Connect',
    desc: 'On the phone: paste the desktop URL + the same pairing id. Devices handshake over WebSocket.',
  },
  {
    num: '04',
    title: 'Capabilities sync',
    desc: 'Each device advertises what it can do. The brain on either side now sees the full fleet.',
  },
]

export function Pairing() {
  return (
    <section id="pairing" className="relative py-28 overflow-hidden bg-[#050508]">
      <div className="absolute inset-0">
        <div className="hero-glow top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cyan-600 opacity-15" />
        <div className="absolute inset-0 bg-dots opacity-40" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-5 tracking-wider uppercase">
            <Network size={12} />
            Cross-Device Mesh
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
            Your phone and desktop. <span className="aurora-text">One brain.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Pair once over your local network and each device becomes an extension of the other.
            The phone brings its sensors; the desktop brings its shell. Same brain, better hardware when it matters.
          </p>
        </motion.div>

        {/* Device diagram */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative flex flex-col md:flex-row items-center justify-center gap-6 md:gap-16 mb-16"
        >
          {/* Phone */}
          <div className="glass-strong rounded-2xl p-6 w-72 shrink-0 relative overflow-visible">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-violet-500/30 flex items-center justify-center">
                <Smartphone size={18} className="text-violet-300" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Phone</div>
                <div className="text-[10px] text-zinc-500">gia-app · Android</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {phoneCapabilities.map((c) => (
                <div key={c.label} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <c.icon size={14} className="text-violet-400" />
                  <div className="text-[8px] text-zinc-400 text-center leading-tight">{c.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Link */}
          <div className="relative flex flex-col items-center shrink-0">
            {/* Animated dashed line */}
            <svg width="120" height="24" className="hidden md:block" style={{ overflow: 'visible' }}>
              <line
                x1="0" y1="12" x2="120" y2="12"
                stroke="rgba(34,211,238,0.4)"
                strokeWidth="1.5"
                className="mesh-flow"
              />
              <circle cx="0" cy="12" r="3" fill="rgba(168,85,247,0.8)" />
              <circle cx="120" cy="12" r="3" fill="rgba(34,211,238,0.8)" />
            </svg>
            <div className="flex flex-col items-center gap-1.5 mt-3 md:mt-1">
              <div className="flex items-center gap-1.5 text-[9px] text-cyan-400 font-bold tracking-widest uppercase">
                <Key size={10} />
                Unimind
              </div>
              <div className="text-[8px] text-zinc-600">LAN · pairing id = room key</div>
            </div>
          </div>

          {/* Desktop */}
          <div className="glass-strong rounded-2xl p-6 w-80 shrink-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 border border-cyan-500/30 flex items-center justify-center">
                <Monitor size={18} className="text-cyan-300" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Desktop</div>
                <div className="text-[10px] text-zinc-500">gia-cowork · Linux</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {desktopCapabilities.map((c) => (
                <div key={c.label} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <c.icon size={14} className="text-cyan-400" />
                  <div className="text-[8px] text-zinc-400 text-center leading-tight">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-[10px] font-bold text-violet-400 tracking-widest mb-2">{s.num}</div>
              <div className="text-sm font-bold text-zinc-200 mb-2">{s.title}</div>
              <div className="text-xs text-zinc-500 leading-relaxed">{s.desc}</div>
            </motion.div>
          ))}
        </div>

        {/* Security note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Lock size={16} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-200 mb-1">LAN-only by default</div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              The embedded relay binds to <code className="text-violet-400">127.0.0.1:8787</code> —
              traffic never leaves your network unless you deliberately expose it. The pairing id is a
              shared room key: anyone who knows both the relay URL and the id can join, so keep it private.
              Capability policy (allow / ask / deny) lets you control exactly which tools are reachable from
              the paired device.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
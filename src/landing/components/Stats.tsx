import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

interface StatItem {
  value: string
  label: string
  prefix?: string
  suffix?: string
}

const stats: StatItem[] = [
  { value: '18', label: 'AI Providers', suffix: '+' },
  { value: '35', label: 'Tool Actions', suffix: '+' },
  { value: '8', label: 'Integrated Modules' },
  { value: '100', label: 'On-Device', suffix: '%', prefix: '' },
]

function Counter({ value, prefix = '', suffix = '' }: { value: string; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const num = parseInt(value) || 0

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0
          const duration = 1500
          const step = 30
          const timer = setInterval(() => {
            start += step
            if (start >= duration) {
              setCount(num)
              clearInterval(timer)
            } else {
              setCount(Math.floor((start / duration) * num))
            }
          }, step)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [num])

  return (
    <span ref={ref}>
      {prefix}{count}{suffix}
    </span>
  )
}

export function Stats() {
  return (
    <section id="stats" className="relative py-20 bg-[#0a0a12] border-y border-white/[0.04]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl sm:text-5xl font-bold bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent mb-1 tracking-tight">
                <Counter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </div>
              <div className="text-xs text-zinc-600 font-medium uppercase tracking-widest">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

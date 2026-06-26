import React from 'react';
import { motion } from 'motion/react';

interface StatItem {
  value: string;
  label: string;
  suffix?: string;
}

const stats: StatItem[] = [
  { value: '18', label: 'AI Providers', suffix: '+' },
  { value: '35', label: 'Tool Actions', suffix: '+' },
  { value: '8', label: 'Integrated Modules', suffix: '' },
  { value: '100', label: 'On-Device', suffix: '%' },
];

const Counter: React.FC<{ value: string; suffix?: string }> = ({ value, suffix }) => {
  const [count, setCount] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const num = parseInt(value) || 0;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const duration = 1500;
          const step = 30;
          const timer = setInterval(() => {
            start += step;
            if (start >= duration) {
              setCount(num);
              clearInterval(timer);
            } else {
              setCount(Math.floor((start / duration) * num));
            }
          }, step);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [num]);

  return (
    <span ref={ref}>
      {count}{suffix}
    </span>
  );
};

export const Stats: React.FC = () => {
  return (
    <section id="stats" className="relative py-16 bg-[#0d0d14] border-y border-zinc-800/20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent mb-1">
                <Counter value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs text-zinc-600 font-medium uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

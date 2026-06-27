import React from 'react';
import { motion } from 'motion/react';
import {
  GraduationCap, Code2, Beaker, Palette, BarChart2, ListTodo,
  Brain, Users, Star
} from 'lucide-react';

const skills = [
  {
    name: 'Tutor',
    description: 'Personal teacher for any subject. Creates lesson plans, practice questions, and explains complex concepts step by step.',
    icon: <GraduationCap size={18} />,
    color: '#a855f7',
    features: ['Lesson Plans', 'Practice Tests', 'Concept Explanations', 'Grading'],
    gradient: 'from-violet-600/20 to-purple-600/10',
  },
  {
    name: 'Developer',
    description: 'Full-stack coding assistant. Write, debug, review, and architect software projects across any language.',
    icon: <Code2 size={18} />,
    color: '#3b82f6',
    features: ['Code Writing', 'Debugging', 'Code Review', 'Architecture'],
    gradient: 'from-blue-600/20 to-indigo-600/10',
  },
  {
    name: 'Researcher',
    description: 'Deep research engine with web search, data analysis, citation management, and comprehensive summarization.',
    icon: <Beaker size={18} />,
    color: '#10b981',
    features: ['Web Search', 'Data Analysis', 'Cite Sources', 'Summarize'],
    gradient: 'from-emerald-600/20 to-teal-600/10',
  },
  {
    name: 'Creative',
    description: 'Creative writing, image generation, and multimedia content creation with AI-powered inspiration.',
    icon: <Palette size={18} />,
    color: '#ec4899',
    features: ['Story Writing', 'Image Gen', 'Design Ideas', 'Brainstorming'],
    gradient: 'from-pink-600/20 to-rose-600/10',
  },
  {
    name: 'Analyst',
    description: 'Data analysis and business intelligence with rich visualizations, forecasts, and actionable insights.',
    icon: <BarChart2 size={18} />,
    color: '#f59e0b',
    features: ['Charts', 'Reports', 'Forecasts', 'Insights'],
    gradient: 'from-amber-600/20 to-orange-600/10',
  },
  {
    name: 'Planner',
    description: 'Project planning and task management. Creates schedules, milestones, and automated task tracking.',
    icon: <ListTodo size={18} />,
    color: '#22d3ee',
    features: ['Schedules', 'Milestones', 'Task Lists', 'Deadlines'],
    gradient: 'from-cyan-600/20 to-sky-600/10',
  },
];

export const Skills: React.FC = () => {
  return (
    <section className="relative py-28 overflow-hidden bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-semibold mb-4 tracking-widest uppercase">
            <Users size={12} />
            Skill System
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Role-Based AI Personas
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm sm:text-base">
            Instantly transform GIA into a specialized expert. Each skill comes with tailored prompts,
            curated tool access, and unique behavior patterns — or create your own.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {skills.map((skill, i) => (
            <motion.div
              key={skill.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6, scale: 1.01 }}
              className="group relative p-6 rounded-2xl transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"
                style={{
                  background: `radial-gradient(400px circle at 50% 0%, ${skill.color}10, transparent 60%)`,
                }}
              />
              <div className="relative z-10">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${skill.color}15`, color: skill.color }}
                >
                  {skill.icon}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{skill.name}</h3>
                <p className="text-[12px] text-zinc-500 mb-4 leading-relaxed">{skill.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {skill.features.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold tracking-wide"
                      style={{
                        background: `${skill.color}10`,
                        color: skill.color,
                        border: `1px solid ${skill.color}18`,
                      }}
                    >
                      <Star size={7} />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/30 border border-zinc-700/20 text-xs text-zinc-500">
            <Brain size={12} />
            Custom skills: name your own persona, write its system prompt, toggle tool access
          </div>
        </motion.div>
      </div>
    </section>
  );
};

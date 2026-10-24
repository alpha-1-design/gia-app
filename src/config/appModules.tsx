import { MessageCircle, GraduationCap, BarChart2, PenLine, ListTodo, Settings, Bot, Target, Hammer } from 'lucide-react';
import type { Module } from '../store/useGiaStore';

export const MODULES: { id: Module; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'chat',     label: 'Chat',     icon: <MessageCircle size={18} />, color: 'var(--gia-text)' },
  { id: 'build',    label: 'Build',    icon: <Hammer size={18} />,        color: 'var(--gia-text)' },
  { id: 'exam',     label: 'Exam',     icon: <GraduationCap size={18} />, color: 'var(--gia-text)' },
  { id: 'analyst',  label: 'Analyst',  icon: <BarChart2 size={18} />,    color: 'var(--gia-text)' },
  { id: 'writer',   label: 'Writer',   icon: <PenLine size={18} />,      color: 'var(--gia-text)' },
  { id: 'planner',  label: 'Planner',  icon: <ListTodo size={18} />,     color: 'var(--gia-text)' },
  { id: 'agents',   label: 'Agents',   icon: <Bot size={18} />,          color: 'var(--gia-text)' },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} />,     color: 'var(--gia-text)' },
  { id: 'autonomy', label: 'Autonomy', icon: <Target size={18} />,       color: 'var(--gia-text)' },
];

import type { LucideIcon } from 'lucide-react';
import {
  Bot, Brain, Code2, Wand2, Sparkles, Star, Rocket, Zap,
  Globe, BookOpen, GraduationCap, Palette, PenLine, BarChart2,
  Search, Target, Shield, Compass, Cpu, Database, Image,
  Lightbulb, Cloud, Gem, Crown, Flame, Feather, Mic,
  MessageCircle, Music, Camera, Eye, Share2, Link, Award,
  Sun, Moon, Wind, Leaf, Download, Hash, Flag,
} from 'lucide-react';

export const AGENT_ICONS: { name: string; icon: LucideIcon; color: string }[] = [
  { name: 'Bot', icon: Bot, color: '#a855f7' },
  { name: 'Brain', icon: Brain, color: '#ec4899' },
  { name: 'Code2', icon: Code2, color: '#3b82f6' },
  { name: 'Wand2', icon: Wand2, color: '#f59e0b' },
  { name: 'Sparkles', icon: Sparkles, color: '#fbbf24' },
  { name: 'Star', icon: Star, color: '#fbbf24' },
  { name: 'Rocket', icon: Rocket, color: '#ef4444' },
  { name: 'Zap', icon: Zap, color: '#f59e0b' },
  { name: 'Globe', icon: Globe, color: '#34d399' },
  { name: 'BookOpen', icon: BookOpen, color: '#6366f1' },
  { name: 'GraduationCap', icon: GraduationCap, color: '#f59e0b' },
  { name: 'Palette', icon: Palette, color: '#ec4899' },
  { name: 'PenLine', icon: PenLine, color: '#06b6d4' },
  { name: 'BarChart2', icon: BarChart2, color: '#3b82f6' },
  { name: 'Search', icon: Search, color: '#8b5cf6' },
  { name: 'Target', icon: Target, color: '#ef4444' },
  { name: 'Shield', icon: Shield, color: '#34d399' },
  { name: 'Compass', icon: Compass, color: '#10b981' },
  { name: 'Cpu', icon: Cpu, color: '#a855f7' },
  { name: 'Database', icon: Database, color: '#6366f1' },
  { name: 'Lightbulb', icon: Lightbulb, color: '#fbbf24' },
  { name: 'Cloud', icon: Cloud, color: '#3b82f6' },
  { name: 'Gem', icon: Gem, color: '#ec4899' },
  { name: 'Crown', icon: Crown, color: '#f59e0b' },
  { name: 'Flame', icon: Flame, color: '#ef4444' },
  { name: 'Feather', icon: Feather, color: '#a855f7' },
  { name: 'Mic', icon: Mic, color: '#06b6d4' },
  { name: 'MessageCircle', icon: MessageCircle, color: '#34d399' },
  { name: 'Image', icon: Image, color: '#8b5cf6' },
  { name: 'Music', icon: Music, color: '#ec4899' },
  { name: 'Camera', icon: Camera, color: '#6366f1' },
  { name: 'Eye', icon: Eye, color: '#10b981' },
  { name: 'Share2', icon: Share2, color: '#3b82f6' },
  { name: 'Link', icon: Link, color: '#a855f7' },
  { name: 'Award', icon: Award, color: '#f59e0b' },
  { name: 'Sun', icon: Sun, color: '#fbbf24' },
  { name: 'Moon', icon: Moon, color: '#6366f1' },
  { name: 'Wind', icon: Wind, color: '#34d399' },
  { name: 'Leaf', icon: Leaf, color: '#10b981' },
  { name: 'Download', icon: Download, color: '#3b82f6' },
  { name: 'Hash', icon: Hash, color: '#a855f7' },
  { name: 'Flag', icon: Flag, color: '#ef4444' },
];

const ICON_MAP = new Map(AGENT_ICONS.map(i => [i.name, i]));

export function getAgentIcon(name: string): LucideIcon {
  return ICON_MAP.get(name)?.icon || Bot;
}

export function getAgentColor(name: string): string {
  return ICON_MAP.get(name)?.color || '#a855f7';
}

export function resolveAgentIcon(iconName: string): LucideIcon {
  const found = ICON_MAP.get(iconName);
  if (!found && import.meta.env.DEV && iconName !== 'Bot') {
    console.warn(`[agentIcons] unknown icon "${iconName}" — falling back to Bot`);
  }
  return found?.icon || Bot;
}

export function resolveAgentColor(iconName: string): string {
  return ICON_MAP.get(iconName)?.color || '#a855f7';
}

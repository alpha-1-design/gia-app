import React from 'react';
import { getToolColor } from '../utils/toolIcons';

interface AnimatedIconProps {
  size?: number;
  color?: string;
  animated?: boolean;
}

const defaultAnim = { animation: 'none' };

// ─── Communication ───

export const WhatsAppIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#25D366', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="1" y="1" width="22" height="22" rx="5" stroke={color} strokeWidth="1.5" fill={`${color}15`}
      style={animated ? { animation: 'iconPulse 2s ease-in-out infinite' } : defaultAnim} />
    <path d="M7 12l3 3 7-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={animated ? { strokeDasharray: 20, strokeDashoffset: 0, animation: 'drawCheck 0.6s ease-out' } : defaultAnim} />
  </svg>
);

export const EmailIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#ea4335', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="20" height="16" rx="3" stroke={color} strokeWidth="1.5" fill={`${color}12`} />
    <path d="M2 7l10 6 10-6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={animated ? { strokeDasharray: 30, strokeDashoffset: 0, animation: 'drawPath 0.8s ease-out' } : defaultAnim} />
    {animated && <circle cx="19" cy="8" r="1.5" fill={color} opacity="0.6">
      <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

export const SMSIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#3b82f6', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 10c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6v4c0 3.3-2.7 6-6 6H9c-3.3 0-6-2.7-6-6v-2l-1.5 1.5v-3.5z" stroke={color} strokeWidth="1.5" fill={`${color}12`} />
    <circle cx="8" cy="12" r="1" fill={color}>
      {animated && <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" begin="0s" />}
    </circle>
    <circle cx="12" cy="12" r="1" fill={color}>
      {animated && <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" begin="0.3s" />}
    </circle>
    <circle cx="16" cy="12" r="1" fill={color}>
      {animated && <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" begin="0.6s" />}
    </circle>
  </svg>
);

export const PhoneIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#22c55e', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1l-1.3 1.3a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.7.5 2.6.6A2 2 0 0122 16.9z" stroke={color} strokeWidth="1.5" fill={`${color}12`} />
    {animated && <circle cx="12" cy="10" r="5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3">
      <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

export const ShareIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#a855f7', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="18" cy="5" r="3" stroke={color} strokeWidth="1.5" fill={`${color}20`} />
    <circle cx="6" cy="12" r="3" stroke={color} strokeWidth="1.5" fill={`${color}20`} />
    <circle cx="18" cy="19" r="3" stroke={color} strokeWidth="1.5" fill={`${color}20`} />
    <line x1="15.5" y1="6.5" x2="8.5" y2="10.5" stroke={color} strokeWidth="1.2"
      style={animated ? { strokeDasharray: 10, strokeDashoffset: 0, animation: 'drawPath 0.5s ease-out' } : defaultAnim} />
    <line x1="15.5" y1="17.5" x2="8.5" y2="13.5" stroke={color} strokeWidth="1.2"
      style={animated ? { strokeDasharray: 10, strokeDashoffset: 0, animation: 'drawPath 0.5s ease-out 0.2s' } : defaultAnim} />
    {animated && <circle cx="18" cy="5" r="6" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3">
      <animate attributeName="r" values="3.5;6;3.5" dur="2.5s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

// ─── Utilities ───

export const ClipboardIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f59e0b', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke={color} strokeWidth="1.5" fill={`${color}12`} />
    <rect x="8" y="2" width="8" height="4" rx="1" stroke={color} strokeWidth="1.2" fill={`${color}20`} />
    <path d="M9 13l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={animated ? { strokeDasharray: 15, strokeDashoffset: 0, animation: 'drawCheck 0.5s ease-out' } : defaultAnim} />
  </svg>
);

export const VibrateIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#ec4899', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="6" y="2" width="12" height="20" rx="3" stroke={color} strokeWidth="1.2" fill={`${color}12`} />
    <path d="M3 8l1 4-1 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {animated && <animate attributeName="d" values="M3 8l1 4-1 4;M2 8l1.5 4-1.5 4;M3 8l1 4-1 4" dur="0.4s" repeatCount="indefinite" />}
    </path>
    <path d="M21 8l-1 4 1 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {animated && <animate attributeName="d" values="M21 8l-1 4 1 4;M22 8l-1.5 4 1.5 4;M21 8l-1 4 1 4" dur="0.4s" repeatCount="indefinite" />}
    </path>
  </svg>
);

export const BrightnessIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f97316', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.5" fill={`${color}20`} />
    <g stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <line x1="12" y1="1" x2="12" y2="4">
        {animated && <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="8s" repeatCount="indefinite" />}
      </line>
      <line x1="12" y1="20" x2="12" y2="23">
        {animated && <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="8s" repeatCount="indefinite" />}
      </line>
      <line x1="1" y1="12" x2="4" y2="12">
        {animated && <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="8s" repeatCount="indefinite" />}
      </line>
      <line x1="20" y1="12" x2="23" y2="12">
        {animated && <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="8s" repeatCount="indefinite" />}
      </line>
    </g>
  </svg>
);

// ─── System ───

export const MonitorIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#06b6d4', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="3" width="20" height="14" rx="2" stroke={color} strokeWidth="1.2" fill={`${color}10`} />
    <line x1="8" y1="21" x2="16" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="1.5" />
    {animated && <line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth="0.8" opacity="0.5">
      <animate attributeName="opacity" values="0.5;0.1;0.5" dur="3s" repeatCount="indefinite" />
    </line>}
  </svg>
);

export const ContactsIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#8b5cf6', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="8" r="4" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <path d="M3 21c0-3.3 2.7-6 6-6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="17" cy="10" r="3" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <path d="M21 18c0-2.5-1.8-4.5-4-5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    {animated && <circle cx="9" cy="8" r="5.5" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3">
      <animate attributeName="r" values="4.5;6;4.5" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

export const LinkIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#6366f1', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.5 1.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill={`${color}10`} />
    <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.5-1.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    {animated && <circle cx="12" cy="12" r="1" fill={color} opacity="0.5">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

// ─── Code / Terminal ───

export const CodeIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#ec4899', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M8 6l-6 6 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={`${color}10`} />
    <path d="M16 6l6 6-6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {animated && <line x1="13" y1="4" x2="11" y2="20" stroke={color} strokeWidth="1" opacity="0.4">
      <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite" />
    </line>}
  </svg>
);

export const TerminalIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#22c55e', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="3" width="20" height="18" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M6 9l3 3-3 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="15" x2="18" y2="15" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    {animated && <rect x="14" y="6" width="4" height="2" rx="0.5" fill={color} opacity="0.4">
      <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1s" repeatCount="indefinite" />
    </rect>}
  </svg>
);

// ─── Search / Web ───

export const SearchIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#3b82f6', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="1.5" fill={`${color}12`}>
      {animated && <animate attributeName="r" values="7;6;7" dur="3s" repeatCount="indefinite" />}
    </circle>
    <line x1="16.5" y1="16.5" x2="21" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const GlobeIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#10b981', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.3" fill={`${color}10`}>
      {animated && <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="12s" repeatCount="indefinite" />}
    </circle>
    <ellipse cx="12" cy="12" rx="4" ry="9" stroke={color} strokeWidth="0.8" />
    <line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="0.8" />
  </svg>
);

// ─── Filesystem ───

export const FolderIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f59e0b', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M2 7c0-1.1.9-2 2-2h5l2 2h9c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V7z" stroke={color} strokeWidth="1.5" fill={`${color}12`} />
    {animated && <circle cx="18" cy="13" r="1.5" fill={color} opacity="0.3">
      <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

export const ZipIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f59e0b', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {animated && <line x1="9" y1="12" x2="15" y2="16" stroke={color} strokeWidth="1" opacity="0.5">
      <animate attributeName="opacity" values="0.5;0.2;0.5" dur="1.5s" repeatCount="indefinite" />
    </line>}
  </svg>
);

// ─── Memory / Brain ───

export const BrainIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#8b5cf6', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 4c-2 0-3 1-3 2s1 2 3 2 3-1 3-2-1-2-3-2z" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
    <path d="M9 8c-1.5.5-2.5 1.5-2.5 3s1 2.5 2.5 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15 8c1.5.5 2.5 1.5 2.5 3s-1 2.5-2.5 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 14c-2 0-3 1-3 2s1 2 3 2 3-1 3-2-1-2-3-2z" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
    {animated && <circle cx="12" cy="11" r="1" fill={color} opacity="0.4">
      <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.5s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

export const DownloadIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#34d399', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M7 10l5 5 5-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={animated ? { strokeDasharray: 15, strokeDashoffset: 0, animation: 'drawPath 0.6s ease-out' } : defaultAnim} />
    <line x1="12" y1="15" x2="12" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const UploadIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f59e0b', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M17 8l-5-5-5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={animated ? { strokeDasharray: 15, strokeDashoffset: 0, animation: 'drawPath 0.6s ease-out' } : defaultAnim} />
    <line x1="12" y1="3" x2="12" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const SummarizeIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#8b5cf6', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <line x1="7" y1="9" x2="17" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="13" x2="14" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    {animated && <line x1="7" y1="17" x2="11" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
    </line>}
  </svg>
);

// ─── Location / Map ───

export const MapPinIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#ef4444', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7z" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <circle cx="12" cy="9" r="3" stroke={color} strokeWidth="1.3" fill={`${color}25`}>
      {animated && <animate attributeName="r" values="3;3.5;3" dur="2s" repeatCount="indefinite" />}
    </circle>
  </svg>
);

export const MapIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#10b981', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={`${color}10`} />
    <line x1="9" y1="4" x2="9" y2="17" stroke={color} strokeWidth="1" />
    <line x1="15" y1="7" x2="15" y2="20" stroke={color} strokeWidth="1" />
    {animated && <circle cx="12" cy="12" r="1.5" fill={color} opacity="0.5">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

// ─── Tasks ───

export const CheckSquareIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#3b82f6', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" fill={`${color}12`} />
    <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={animated ? { strokeDasharray: 15, strokeDashoffset: 0, animation: 'drawCheck 0.5s ease-out' } : defaultAnim} />
  </svg>
);

// ─── Notes ───

export const FileTextIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f59e0b' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="8" y1="13" x2="16" y2="13" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    <line x1="8" y1="17" x2="13" y2="17" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

// ─── Autonomy / Goals ───

export const TargetIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#a855f7', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.3" fill={`${color}10`} />
    <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <circle cx="12" cy="12" r="2" stroke={color} strokeWidth="1.3" fill={`${color}25`}>
      {animated && <animate attributeName="r" values="2;2.5;2" dur="2s" repeatCount="indefinite" />}
    </circle>
  </svg>
);

export const SlidersIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#06b6d4', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <line x1="4" y1="6" x2="20" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="6" r="2" stroke={color} strokeWidth="1.5" fill={`${color}20`}>
      {animated && <animate attributeName="cx" values="8;9;8" dur="3s" repeatCount="indefinite" />}
    </circle>
    <line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="16" cy="18" r="2" stroke={color} strokeWidth="1.5" fill={`${color}20`}>
      {animated && <animate attributeName="cx" values="16;15;16" dur="3s" repeatCount="indefinite" />}
    </circle>
  </svg>
);

// ─── Controls ───

export const ToggleIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f59e0b', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="20" height="12" rx="6" stroke={color} strokeWidth="1.5" fill={`${color}12`} />
    <circle cx="8" cy="12" r="4" fill={color}>
      {animated && <animate attributeName="cx" values="8;16;8" dur="2s" repeatCount="indefinite" />}
    </circle>
  </svg>
);

export const BellIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#ec4899', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M13.7 20a2 2 0 01-3.4 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    {animated && <line x1="12" y1="2" x2="12" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <animate attributeName="y1" values="2;1;2" dur="0.5s" repeatCount="indefinite" />
    </line>}
  </svg>
);

// ─── GitHub ───

export const GitHubIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f0f0f0', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.66-.22.66-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.35 1.08 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.57 9.57 0 0112 6.8c.85.01 1.7.12 2.5.35 1.9-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.16.58.68.48A10.02 10.02 0 0022 12c0-5.52-4.48-10-10-10z" stroke={color} strokeWidth="1.2" fill={`${color}12`} />
    {animated && <circle cx="12" cy="12" r="2" fill={color} opacity="0.3">
      <animate attributeName="r" values="2;3;2" dur="3s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

// ─── Knowledge ───

export const BookIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f59e0b', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    {animated && <line x1="8" y1="7" x2="16" y2="7" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.5">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
    </line>}
  </svg>
);

// ─── Weather ───

export const CloudIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#3b82f6', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M18 10a5 5 0 00-4.6-3 4 4 0 00-7.2 1.5A4.5 4.5 0 008.5 17H17a4 4 0 001-7.9z" stroke={color} strokeWidth="1.5" fill={`${color}12`} />
    {animated && <circle cx="12" cy="8" r="1.5" fill={color} opacity="0.3">
      <animate attributeName="cy" values="8;7;8" dur="3s" repeatCount="indefinite" />
    </circle>}
  </svg>
);

export const SunCloudIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f59e0b', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.5" fill={`${color}20`} />
    <path d="M18 10a5 5 0 00-4.6-3 4 4 0 00-7.2 1.5A4.5 4.5 0 008.5 17H17a4 4 0 001-7.9z" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    {animated && <line x1="8" y1="2" x2="8" y2="4" stroke={color} strokeWidth="1" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="10s" repeatCount="indefinite" />
    </line>}
  </svg>
);

// ─── Image / Vision ───

export const ImageIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#ec4899' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="3" width="20" height="18" rx="3" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <circle cx="8.5" cy="9.5" r="2" stroke={color} strokeWidth="1.5" fill={`${color}20`} />
    <path d="M21 16l-5-5-5 5-3-3-6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
  </svg>
);

export const CameraIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#06b6d4', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <circle cx="12" cy="13" r="4" stroke={color} strokeWidth="1.5" fill={`${color}15`}>
      {animated && <animate attributeName="r" values="4;3.5;4" dur="2s" repeatCount="indefinite" />}
    </circle>
  </svg>
);

// ─── Data / Math ───

export const ChartIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#06b6d4', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M7 17l3-6 3 3 4-6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={animated ? { strokeDasharray: 25, strokeDashoffset: 0, animation: 'drawPath 1s ease-out' } : defaultAnim} />
  </svg>
);

export const HashIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#a855f7' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <line x1="10" y1="4" x2="8" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="4" x2="14" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="4" y1="9" x2="20" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="4" y1="15" x2="20" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const QrCodeIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#f97316', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
    <rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
    <rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
    <rect x="14" y="14" width="2.5" height="2.5" rx="0.5" fill={color} />
    <rect x="14" y="18.5" width="2.5" height="2.5" rx="0.5" fill={color} />
    <rect x="18.5" y="14" width="2.5" height="2.5" rx="0.5" fill={color}>
      {animated && <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />}
    </rect>
  </svg>
);

export const ClassifyIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#8b5cf6', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="4" rx="1" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <rect x="14" y="3" width="7" height="4" rx="1" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <rect x="3" y="10" width="7" height="4" rx="1" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <rect x="14" y="10" width="7" height="4" rx="1" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <rect x="3" y="17" width="7" height="4" rx="1" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    {animated && <rect x="14" y="17" width="7" height="4" rx="1" stroke={color} strokeWidth="1.3" fill={`${color}30`}>
      <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
    </rect>}
  </svg>
);

export const ListIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#06b6d4', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <line x1="8" y1="6" x2="21" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="18" x2="21" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="4" cy="6" r="1.5" fill={color}>
      {animated && <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />}
    </circle>
    <circle cx="4" cy="12" r="1.5" fill={color} />
    <circle cx="4" cy="18" r="1.5" fill={color} />
  </svg>
);

export const InfoIcon: React.FC<AnimatedIconProps> = ({ size = 20, color = '#3b82f6', animated = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" fill={`${color}12`} />
    <line x1="12" y1="11" x2="12" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="8" r="1" fill={color}>
      {animated && <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />}
    </circle>
  </svg>
);

export const ToolIcon: React.FC<{ toolId: string; size?: number; color?: string; animated?: boolean }> = ({ toolId, size = 20, color, animated = true }) => {
  const c = color || getToolColor(toolId);
  const iconMap: Record<string, React.ReactNode> = {
    // Communication
    send_whatsapp: <WhatsAppIcon size={size} color={c} animated={animated} />,
    send_email: <EmailIcon size={size} color={c} animated={animated} />,
    send_sms: <SMSIcon size={size} color={c} animated={animated} />,
    make_phone_call: <PhoneIcon size={size} color={c} animated={animated} />,
    share: <ShareIcon size={size} color={c} animated={animated} />,
    // Utilities
    clipboard: <ClipboardIcon size={size} color={c} animated={animated} />,
    vibrate: <VibrateIcon size={size} color={c} animated={animated} />,
    screen_brightness: <BrightnessIcon size={size} color={c} animated={animated} />,
    // System
    device_info: <MonitorIcon size={size} color={c} animated={animated} />,
    get_contacts: <ContactsIcon size={size} color={c} animated={animated} />,
    open_url: <LinkIcon size={size} color={c} animated={animated} />,
    // Web
    web_search: <SearchIcon size={size} color={c} animated={animated} />,
    web_scrape: <GlobeIcon size={size} color={c} animated={animated} />,
    http_request: <CodeIcon size={size} color={c} animated={animated} />,
    read_url: <GlobeIcon size={size} color={c} animated={animated} />,
    browser_navigate: <GlobeIcon size={size} color={c} animated={animated} />,
    page_info: <InfoIcon size={size} color={c} animated={animated} />,
    // Code
    terminal_run: <TerminalIcon size={size} color={c} animated={animated} />,
    environment_info: <InfoIcon size={size} color={c} animated={animated} />,
    // GitHub
    github: <GitHubIcon size={size} color={c} animated={animated} />,
    // Knowledge
    wikipedia: <BookIcon size={size} color={c} animated={animated} />,
    define: <BookIcon size={size} color={c} animated={animated} />,
    weather: <CloudIcon size={size} color={c} animated={animated} />,
    // Image
    image_generation: <ImageIcon size={size} color={c} animated={animated} />,
    screenshot: <CameraIcon size={size} color={c} animated={animated} />,
    // Filesystem
    filesystem_read: <FolderIcon size={size} color={c} animated={animated} />,
    filesystem_write: <FolderIcon size={size} color={c} animated={animated} />,
    list_files: <FolderIcon size={size} color={c} animated={animated} />,
    zip_project: <ZipIcon size={size} color={c} animated={animated} />,
    filesystem_desktop_read: <FolderIcon size={size} color={c} animated={animated} />,
    filesystem_desktop_write: <FolderIcon size={size} color={c} animated={animated} />,
    filesystem_desktop_list: <FolderIcon size={size} color={c} animated={animated} />,
    // Controls
    switch_module: <ToggleIcon size={size} color={c} animated={animated} />,
    toggle_feature: <ToggleIcon size={size} color={c} animated={animated} />,
    show_notification: <BellIcon size={size} color={c} animated={animated} />,
    request_clarification: <InfoIcon size={size} color={c} animated={animated} />,
    // Memory
    forget_memory: <BrainIcon size={size} color={c} animated={animated} />,
    summarize_conversation: <SummarizeIcon size={size} color={c} animated={animated} />,
    export_brain: <DownloadIcon size={size} color={c} animated={animated} />,
    import_brain: <UploadIcon size={size} color={c} animated={animated} />,
    // Location
    get_user_location: <MapPinIcon size={size} color={c} animated={animated} />,
    search_places: <MapIcon size={size} color={c} animated={animated} />,
    show_map: <MapIcon size={size} color={c} animated={animated} />,
    // Tasks
    task_create: <CheckSquareIcon size={size} color={c} animated={animated} />,
    task_read: <CheckSquareIcon size={size} color={c} animated={animated} />,
    task_update: <CheckSquareIcon size={size} color={c} animated={animated} />,
    task_delete: <CheckSquareIcon size={size} color={c} animated={animated} />,
    task_move: <CheckSquareIcon size={size} color={c} animated={animated} />,
    // Notes
    note_create: <FileTextIcon size={size} color={c} animated={animated} />,
    note_read: <FileTextIcon size={size} color={c} animated={animated} />,
    note_update: <FileTextIcon size={size} color={c} animated={animated} />,
    note_delete: <FileTextIcon size={size} color={c} animated={animated} />,
    note_toggle_pin: <FileTextIcon size={size} color={c} animated={animated} />,
    // Autonomy
    create_goal: <TargetIcon size={size} color={c} animated={animated} />,
    list_goals: <TargetIcon size={size} color={c} animated={animated} />,
    pause_goal: <TargetIcon size={size} color={c} animated={animated} />,
    goal_progress: <TargetIcon size={size} color={c} animated={animated} />,
    set_autonomy_config: <SlidersIcon size={size} color={c} animated={animated} />,
    // Power tools
    data_analysis: <ChartIcon size={size} color={c} animated={animated} />,
    math: <HashIcon size={size} color={c} animated={animated} />,
    local_search: <SearchIcon size={size} color={c} animated={animated} />,
    encode_decode: <ClipboardIcon size={size} color={c} animated={animated} />,
    generate_qr: <QrCodeIcon size={size} color={c} animated={animated} />,
    classify_text: <ClassifyIcon size={size} color={c} animated={animated} />,
    list_available_apis: <ListIcon size={size} color={c} animated={animated} />,
  };
  return <>{iconMap[toolId] || <TerminalIcon size={size} color={c} animated={animated} />}</>;
};

import React, { useState } from 'react';
import { User, Save, ChevronRight, Sparkles, Zap, Download } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useGiaStore } from '../../store/useGiaStore';
import { useGiaIdentity } from '../../store/useGiaIdentity';
import { SubPageHeader } from './SubPageHeader';
import { SkillsSubPage } from './SkillsSubPage';
import { IdentitySubPage } from './IdentitySubPage';
import { BrainExportSubPage } from './BrainExportSubPage';
import { MemorySection } from './MemorySection';

type SubPage = 'main' | 'skills' | 'identity' | 'brain-export';

export const ProfileIdentityPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [page, setPage] = useState<SubPage>('main');
  const { userProfile, setUserProfile } = useGiaStore(useShallow(s => ({
    userProfile: s.userProfile, setUserProfile: s.setUserProfile,
  })));
  const identity = useGiaIdentity(s => s.identity);
  const skills = useGiaStore(s => s.skills);
  const [editProfile, setEditProfile] = useState(false);
  const [name, setProfileName] = useState(userProfile.name);
  const [bio, setBio] = useState(userProfile.bio);
  const [goals, setGoals] = useState(userProfile.goals);

  const saveProfile = () => {
    setUserProfile({ name: name.trim(), bio: bio.trim(), goals: goals.trim() });
    setEditProfile(false);
  };

  if (page === 'skills') return <SkillsSubPage onBack={() => setPage('main')} />;
  if (page === 'identity') return <IdentitySubPage onBack={() => setPage('main')} />;
  if (page === 'brain-export') return <BrainExportSubPage onBack={() => setPage('main')} />;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="Profile & Identity" onBack={onBack} />

      <div className="px-3 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', color: 'var(--gia-muted)' }}>
        <p className="font-semibold mb-2" style={{ color: '#a855f7' }}>About this panel</p>
        <p className="mb-2">This is where you shape how GIA sees you and how she responds. Everything here is about personalisation — making GIA feel like yours.</p>
        <ul className="space-y-1.5 pl-3" style={{ listStyle: 'disc' }}>
          <li><strong style={{ color: '#a855f7' }}>Your Profile</strong> — Tell GIA your name, background, and goals. This helps her tailor responses to your context. Eg: "WASSCE student" means she'll explain things clearly.</li>
          <li><strong style={{ color: '#a855f7' }}>GIA Identity</strong> — Control GIA's name, personality (warm/professional/witty), tone, and how proactive she is. Go <em>Identity → Custom</em> to write your own persona prompt.</li>
          <li><strong style={{ color: '#a855f7' }}>Neural Skills</strong> — Add custom AI personas with specific tools. A "Code Reviewer" skill gets terminal + filesystem access. A "Travel Guide" gets web search.</li>
          <li><strong style={{ color: '#a855f7' }}>Brain Export</strong> — Backup or restore all memories, identity, skills, and profile as a JSON file. Also supports cloud sync to WebDAV/S3.</li>
          <li><strong style={{ color: '#a855f7' }}>Memory</strong> — GIA stores facts, preferences, and context across conversations. Search, review, or delete individual memories here.</li>
        </ul>
        <p className="mt-2 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
          Tip: Set your profile first — even just your name — before tweaking GIA's identity. A good profile makes everything else more relevant.
        </p>
      </div>

      {/* Profile */}
      <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={14} style={{ color: '#a855f7' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
              Your Profile
            </span>
          </div>
          <button onClick={() => setEditProfile(e => !e)}
            className="text-[11px] font-medium" style={{ color: '#a855f7' }}>
            {editProfile ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {editProfile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Your name', val: name, set: setProfileName, placeholder: 'e.g. Samuel' },
              { label: 'About you', val: bio, set: setBio, placeholder: 'e.g. WASSCE student in Ghana' },
              { label: 'Goals', val: goals, set: setGoals, placeholder: 'e.g. Pass WASSCE, ship my app' },
            ].map(f => (
              <div key={f.label}>
                <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                <input className="gia-input" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} />
              </div>
            ))}
            <button onClick={saveProfile} className="gia-btn gia-btn-primary w-full mt-1"><Save size={13} /> Save Profile</button>
          </div>
        ) : (
          <div>
            {userProfile.name ? (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{userProfile.name}</p>
                {userProfile.bio && <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>{userProfile.bio}</p>}
                {userProfile.goals && <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: '#a855f7' }}>✦ {userProfile.goals}</p>}
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>No profile set — add your name so GIA can personalise responses.</p>
            )}
          </div>
        )}
      </div>

      {/* Navigations */}
      <button onClick={() => setPage('identity')}
        className="gia-card p-4 flex items-center gap-4 w-full text-left tap-feedback">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0d0d14', border: '1px solid rgba(168,85,247,0.2)' }}>
          <Sparkles size={18} style={{ color: '#a855f7' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>GIA Identity</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>
            {identity.name} · {identity.personalityStyle} · {identity.tone} tone
          </p>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)' }} />
      </button>

      <button onClick={() => setPage('skills')}
        className="gia-card p-4 flex items-center gap-4 w-full text-left tap-feedback">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0d0d14', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Zap size={18} style={{ color: '#f59e0b' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Neural Skills</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>
            {skills.length} active · {skills.filter(s => s.category === 'user').length} custom
          </p>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)' }} />
      </button>

      <button onClick={() => setPage('brain-export')}
        className="gia-card p-4 flex items-center gap-4 w-full text-left tap-feedback">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0d0d14', border: '1px solid rgba(16,185,129,0.2)' }}>
          <Download size={18} style={{ color: '#34d399' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Brain Export</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>Backup or restore GIA memories and identity</p>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)' }} />
      </button>

      <MemorySection />
    </div>
  );
};

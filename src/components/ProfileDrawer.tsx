import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Settings as SettingsIcon, ChevronRight, UserCircle } from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';
import LeftDrawer from './ui/LeftDrawer';
import { MODULES } from '../config/appModules';

// The left-swipe drawer Sam asked for: profile up top, settings gear below
// it, same shape as most AI apps' side menu. Deliberately kept minimal for
// now (profile, settings, module shortcuts) -- the point of building it as
// its own drawer rather than folding it into an existing sheet is so new
// entries can be added here later without it turning into another
// "everything crammed into one screen" situation.
const ProfileDrawer: React.FC = () => {
  const { showLeftDrawer, setShowLeftDrawer, userProfile, setModule, hiddenModules } = useGiaStore(useShallow((s) => ({
    showLeftDrawer: s.showLeftDrawer,
    setShowLeftDrawer: s.setShowLeftDrawer,
    userProfile: s.userProfile,
    setModule: s.setModule,
    hiddenModules: s.hiddenModules,
  })));

  const goTo = (page: 'profile-identity' | 'settings') => {
    setShowLeftDrawer(false);
    setModule('settings');
    // SettingsModule owns its own sub-page state; jumping straight to
    // Profile & Identity from here would need that state lifted or a
    // shared navigation target. Out of scope for this pass -- lands on
    // the Settings main screen either way, which still gets the job done.
    void page;
  };

  const visibleModules = MODULES.filter((m) => m.id !== 'chat' && m.id !== 'settings' && !hiddenModules.includes(m.id));

  return (
    <LeftDrawer open={showLeftDrawer} onClose={() => setShowLeftDrawer(false)}>
      {/* Profile */}
      <button
        onClick={() => goTo('profile-identity')}
        className="flex items-center gap-3 px-4 py-5 text-left tap-feedback transition-colors active:bg-white/5 shrink-0"
        style={{ borderBottom: '1px solid var(--gia-border)' }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 12px rgba(168,85,247,0.4)' }}
        >
          {userProfile.name ? userProfile.name[0].toUpperCase() : <UserCircle size={22} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--gia-text)' }}>
            {userProfile.name || 'Set up your profile'}
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--gia-muted)' }}>
            {userProfile.bio || 'Tap to add a bio and goals'}
          </p>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--gia-muted-2)' }} />
      </button>

      {/* Settings */}
      <button
        onClick={() => goTo('settings')}
        className="flex items-center gap-3 px-4 py-3 text-left tap-feedback transition-colors active:bg-white/5 shrink-0"
      >
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--gia-muted)' }}>
          <SettingsIcon size={16} />
        </span>
        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--gia-text)' }}>Settings</span>
        <ChevronRight size={16} style={{ color: 'var(--gia-muted-2)' }} />
      </button>

      {/* Module shortcuts -- respects the same hidden-modules list as the
          top nav dropdown and command palette. */}
      {visibleModules.length > 0 && (
        <div className="mt-2 pt-2 overflow-y-auto" style={{ borderTop: '1px solid var(--gia-border)' }}>
          {visibleModules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => { setShowLeftDrawer(false); setModule(mod.id); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left tap-feedback transition-colors active:bg-white/5"
            >
              <span style={{ color: mod.color }}>{mod.icon}</span>
              <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--gia-text)' }}>{mod.label}</span>
            </button>
          ))}
        </div>
      )}
    </LeftDrawer>
  );
};

export default ProfileDrawer;

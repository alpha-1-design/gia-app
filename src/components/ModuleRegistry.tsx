import React from 'react';
import { useGiaStore } from '../store/useGiaStore';
import ChatModule from '../modules/ChatModule';
import SettingsModule from '../modules/SettingsModule';
import AnalystModule from '../modules/AnalystModule';
import WriterModule from '../modules/WriterModule';
import PlannerModule from '../modules/PlannerModule';

const PlaceholderModule = ({ name }: { name: string }) => (
  <div className="flex items-center justify-center h-full text-gia-muted font-medium">
    <div className="gia-card p-12 text-center">
      <h2 className="text-2xl font-bold text-gia-text mb-2">{name} Module</h2>
      <p>This is a high-definition placeholder. Morphing soon...</p>
    </div>
  </div>
);

const ModuleRegistry = () => {
  const currentModule = useGiaStore((state) => state.currentModule);

  switch (currentModule) {
    case 'chat':
      return <ChatModule />;
    case 'writer':
      return <WriterModule />;
    case 'analyst':
      return <AnalystModule />;
    case 'planner':
      return <PlannerModule />;
    case 'settings':
      return <SettingsModule />;
    default:
      return <ChatModule />;
  }
};

export default ModuleRegistry;

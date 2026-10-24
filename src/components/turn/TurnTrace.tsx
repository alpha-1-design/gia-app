import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Brain, Check, ChevronRight } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import type { OrbState } from 'thinking-orbs';
import { useGiaStore } from '../../store/useGiaStore';
import type { MessageSegment } from '../../store/useGiaStore';
import { buildTrace, collectThinking, formatJobDuration } from './buildTrace';
import { TOOL_META, toolColor, toolIcon } from './toolMeta';

const PHASE_LABEL: Record<string, string> = {
  gathering: 'Reading context',
  analyzing: 'Analyzing',
  coding: 'Writing code',
  writing: 'Writing',
  searching: 'Searching',
  planning: 'Planning',
  reasoning: 'Thinking',
  processing: 'Working',
  idle: 'Thinking',
};

const PHASE_ORB: Record<string, OrbState> = {
  gathering: 'searching',
  searching: 'searching',
  coding: 'working',
  processing: 'working',
  writing: 'composing',
  planning: 'solving',
  reasoning: 'solving',
  analyzing: 'solving',
};

interface TurnTraceProps {
  segments?: MessageSegment[];
  thoughts?: string;
  isLive: boolean;
  startedAt: number;
  durationMs?: number;
  phase?: string;
  plan?: string;
}

export const TurnTrace: React.FC<TurnTraceProps> = ({
  segments = [],
  thoughts = '',
  isLive,
  startedAt,
  durationMs = 0,
  phase = '',
  plan = '',
}) => {
  const [expanded, setExpanded] = useState(isLive);
  const [showThinking, setShowThinking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const appTheme = useGiaStore(state => state.theme);

  useEffect(() => {
    setExpanded(isLive);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const trail = useMemo(() => segments.filter(segment => segment.type !== 'text'), [segments]);
  const groups = useMemo(() => buildTrace(trail), [trail]);
  const thinking = useMemo(
    () => collectThinking(trail) || (trail.length === 0 ? thoughts.trim() : ''),
    [trail, thoughts],
  );
  const running = groups.find(group => group.running);
  const failed = groups.some(group => group.failed);

  if (!isLive && trail.length === 0 && !thinking) return null;

  const fallbackDuration = trail.length > 0
    ? Math.max(...trail.map(segment => segment.startedAt)) - startedAt
    : 0;
  const elapsed = isLive ? Math.max(0, now - startedAt) : (durationMs > 0 ? durationMs : fallbackDuration);
  const duration = formatJobDuration(elapsed);
  const completedLabel = groups.length > 0 || duration ? 'Worked' : 'Thoughts';

  const liveLabel = running
    ? (TOOL_META[running.toolName]?.label ?? running.verb)
    : (PHASE_LABEL[phase] ?? 'Thinking');
  const orbState: OrbState = PHASE_ORB[phase] ?? 'working';
  const prefersLight = appTheme === 'system'
    && typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: light)').matches;
  const orbTheme = appTheme === 'light' || prefersLight ? 'light' : 'dark';
  const orbColor = orbTheme === 'light' ? '#7c3aed' : '#c4b5fd';

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        aria-label={isLive
          ? (duration ? `Working ${duration}` : 'Working')
          : `${completedLabel}${duration ? ` for ${duration}` : ''}`}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          {isLive ? (
            <ThinkingOrb
              state={orbState}
              size={20}
              theme={orbTheme}
              color={orbColor}
              aria-hidden="true"
            />
          ) : failed ? (
            <AlertCircle size={13} style={{ color: '#f87171' }} aria-hidden="true" />
          ) : (
            <Check size={13} strokeWidth={2.5} style={{ color: '#34d399' }} aria-hidden="true" />
          )}
        </span>

        <span className="text-[12.5px] leading-none" style={{ color: isLive ? 'var(--gia-text)' : 'var(--gia-muted)' }}>
          {isLive ? liveLabel : completedLabel}
        </span>
        {!isLive && duration ? (
          <span className="text-[12px] leading-none" style={{ color: 'var(--gia-muted-2)' }}>for</span>
        ) : null}
        {duration ? (
          <span className="text-[12px] leading-none tabular-nums" style={{ color: 'var(--gia-muted-2)' }}>{duration}</span>
        ) : null}

        <span className="ml-auto flex items-center" style={{ color: 'var(--gia-muted-2)' }}>
          <ChevronRight
            size={12}
            aria-hidden="true"
            className="transition-transform"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          />
        </span>
      </button>

      {!expanded && groups.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {groups.slice(0, 3).map(group => (
            <span key={group.key} className="inline-flex items-center gap-1.5">
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: toolColor(group.toolName, group.category) }}
              />
              <span style={{ color: 'var(--gia-muted)' }}>
                {group.count} {group.count === 1 ? group.singular : group.plural}
              </span>
            </span>
          ))}
          {groups.length > 3 ? (
            <span style={{ color: 'var(--gia-muted-2)' }}>+{groups.length - 3} more</span>
          ) : null}
        </div>
      ) : null}

      {plan ? (
        <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: 'var(--gia-text)' }}>
          {plan}
        </p>
      ) : null}

      {expanded && groups.length > 0 ? (
        <div className="mt-2.5 flex flex-col gap-2">
          {groups.map(group => {
            const color = toolColor(group.toolName, group.category);
            return (
              <div key={group.key}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
                    style={{ background: `${color}14`, color }}
                  >
                    {toolIcon(group.toolName)}
                  </span>
                  <span className="text-[12px] leading-none" style={{ color: 'var(--gia-muted)' }}>
                    {group.verb}{' '}
                    <span className="font-medium" style={{ color: 'var(--gia-text)' }}>
                      {group.count} {group.count === 1 ? group.singular : group.plural}
                    </span>
                  </span>
                  {group.failed ? (
                    <AlertCircle size={10} style={{ color: '#f87171' }} aria-label="Some actions failed" />
                  ) : null}
                </div>

                {group.details.length > 0 ? (
                  <div className="ml-6 mt-1 flex flex-col gap-0.5">
                    {group.details.slice(0, 8).map((detail, index) => (
                      <span key={`${group.key}-${index}`} className="truncate text-[11px]" style={{ color: 'var(--gia-muted-2)' }}>
                        {detail}
                      </span>
                    ))}
                    {group.details.length > 8 ? (
                      <span className="text-[11px]" style={{ color: 'var(--gia-muted-2)' }}>
                        +{group.details.length - 8} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {expanded && thinking ? (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowThinking(value => !value)}
            aria-expanded={showThinking}
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: 'var(--gia-muted-2)' }}
          >
            <Brain size={11} aria-hidden="true" />
            <span>Thinking</span>
            <ChevronRight
              size={10}
              aria-hidden="true"
              className="transition-transform"
              style={{ transform: showThinking ? 'rotate(90deg)' : 'none' }}
            />
          </button>
          {showThinking ? (
            <div
              className="mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed"
              style={{ color: 'var(--gia-muted)' }}
            >
              {thinking}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface SettingsScrollControlsProps {
  scrollRef: React.RefObject<HTMLElement | null>;
}

const EDGE_THRESHOLD = 24;

const SettingsScrollControls: React.FC<SettingsScrollControlsProps> = ({ scrollRef }) => {
  const [edges, setEdges] = React.useState({ top: false, bottom: false });

  React.useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateEdges = () => {
      const maxScroll = element.scrollHeight - element.clientHeight;
      setEdges({
        top: element.scrollTop > EDGE_THRESHOLD,
        bottom: maxScroll > EDGE_THRESHOLD && element.scrollTop < maxScroll - EDGE_THRESHOLD,
      });
    };

    updateEdges();
    element.addEventListener('scroll', updateEdges, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges);
    resizeObserver?.observe(element);
    const mutationObserver = new MutationObserver(updateEdges);
    mutationObserver.observe(element, { childList: true, subtree: true });
    window.addEventListener('resize', updateEdges);

    return () => {
      element.removeEventListener('scroll', updateEdges);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateEdges);
    };
  }, [scrollRef]);

  if (!edges.top && !edges.bottom) return null;

  const scrollTo = (edge: 'top' | 'bottom') => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: edge === 'top' ? 0 : element.scrollHeight, behavior: 'smooth' });
  };

  return createPortal(
    <div
      className="fixed right-4 z-[45] flex flex-col gap-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
      aria-label="Settings page scroll controls"
    >
      {edges.top && (
        <button
          type="button"
          onClick={() => scrollTo('top')}
          aria-label="Scroll settings to top"
          title="Scroll to top"
          className="flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl transition-transform active:scale-95"
          style={{ background: 'rgba(24,24,35,0.92)', borderColor: 'rgba(167,139,250,0.35)', color: '#c4b5fd', boxShadow: '0 6px 20px rgba(0,0,0,0.32)' }}
        >
          <ArrowUp size={17} />
        </button>
      )}
      {edges.bottom && (
        <button
          type="button"
          onClick={() => scrollTo('bottom')}
          aria-label="Scroll settings to bottom"
          title="Scroll to bottom"
          className="flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl transition-transform active:scale-95"
          style={{ background: 'rgba(24,24,35,0.92)', borderColor: 'rgba(167,139,250,0.35)', color: '#c4b5fd', boxShadow: '0 6px 20px rgba(0,0,0,0.32)' }}
        >
          <ArrowDown size={17} />
        </button>
      )}
    </div>,
    document.body,
  );
};

export default SettingsScrollControls;

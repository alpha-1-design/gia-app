import React, { useMemo } from 'react';
import type { BuildStyle } from '../config/buildStyles';
import { CarouselRing, CarouselRingItem } from './CarouselRing';

interface Props {
  styles: BuildStyle[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Flat, scrollable list instead of the spinning ring. */
  flat?: boolean;
}

const CARD_W = 104;
const CARD_H = 140;

/**
 * A ring of style cards in 3D. Drag to spin it, tap a card to choose it (the
 * ring turns it to the front). Spins slowly on its own until you touch it.
 * The ring is animated through refs, so spinning never re-renders React.
 */
export const StyleCarousel: React.FC<Props> = ({ styles, selectedId, onSelect, flat = false }) => {
  const items = useMemo<CarouselRingItem[]>(
    () => styles.map(s => ({ id: s.id, label: s.label, tagline: s.tagline, color: s.rgb })),
    [styles],
  );
  return (
    <CarouselRing
      items={items}
      selectedId={selectedId}
      onSelect={onSelect}
      flat={flat}
      width={CARD_W}
      height={CARD_H}
    />
  );
};
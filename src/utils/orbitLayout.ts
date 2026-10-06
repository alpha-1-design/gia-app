export interface OrbitPoint { x: number; y: number }

/**
 * Evenly spaced centre points around a circle, starting at 12 o'clock and
 * going clockwise. `size` is the side of the square container.
 */
export function orbitPoints(count: number, size: number, radius: number): OrbitPoint[] {
  const c = size / 2;
  return Array.from({ length: count }, (_, i) => {
    const a = (i * 2 * Math.PI) / count - Math.PI / 2;
    return { x: c + radius * Math.cos(a), y: c + radius * Math.sin(a) };
  });
}

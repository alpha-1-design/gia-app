/** Where the ring must rotate to bring card `index` to the front. */
export function angleForIndex(index: number, count: number): number {
  return -(index * 360) / count;
}

/** Shortest signed rotation from `from` to `to`, so the ring never spins the long way round. */
export function shortestDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

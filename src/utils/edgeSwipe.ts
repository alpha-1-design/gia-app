export interface EdgeSwipeState {
  startX: number;
  startY: number;
}

const EDGE_ZONE_PX = 24;
const OPEN_THRESHOLD_PX = 60;
const MAX_VERTICAL_DRIFT_PX = 60;

/** Call on touchstart. Returns swipe-tracking state if the touch began within the left edge zone, otherwise null (not a candidate gesture). */
export function beginEdgeSwipe(x: number, y: number): EdgeSwipeState | null {
  if (x > EDGE_ZONE_PX) return null;
  return { startX: x, startY: y };
}

/**
 * Call on touchmove/touchend with the current pointer position. Returns true
 * once the gesture has moved far enough right, with a mostly-horizontal
 * path, to count as "open the drawer." Only counts drift where it's small
 * relative to the horizontal distance travelled, so a mostly-vertical drag
 * near the edge (e.g. scrolling) doesn't accidentally open it.
 */
export function shouldOpenFromEdgeSwipe(state: EdgeSwipeState, currentX: number, currentY: number): boolean {
  const dx = currentX - state.startX;
  const dy = Math.abs(currentY - state.startY);
  if (dx < OPEN_THRESHOLD_PX) return false;
  if (dy > MAX_VERTICAL_DRIFT_PX) return false;
  return true;
}

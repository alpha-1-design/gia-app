import type { PanInfo } from 'motion/react';

/** Used by BottomSheet: drag down past this distance or velocity to dismiss. */
export function shouldDismissFromDrag(info: Pick<PanInfo, 'offset' | 'velocity'>): boolean {
  const draggedFarEnough = info.offset.y > 120;
  const flickedDownFast = info.velocity.y > 500;
  return draggedFarEnough || flickedDownFast;
}

/** Used by LeftDrawer: drag left past this distance or velocity to dismiss. */
export function shouldDismissFromLeftDrag(info: Pick<PanInfo, 'offset' | 'velocity'>): boolean {
  const draggedFarEnough = info.offset.x < -100;
  const flickedLeftFast = info.velocity.x < -500;
  return draggedFarEnough || flickedLeftFast;
}

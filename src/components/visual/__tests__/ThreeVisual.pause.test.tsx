import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import * as THREE from 'three';
import ThreeVisual from '../ThreeVisual';

// Battery/perf guards for the render loop:
//  - an idle animated scene holds a 30fps cap (frame-time accumulator) and
//    only runs at the full rAF rate during a ~600ms interaction window;
//  - rotation speeds are frame-delta-scaled (fps-independent);
//  - the loop stops while the document is hidden and resumes when visible;
//  - the loop and GPU resources are torn down on unmount.
// The real three.js needs WebGL, which jsdom can't provide, so the module is
// replaced with observable fakes. __renderers / __meshes capture the objects
// the component constructs so tests can assert on render() calls and rotation.

interface FakeAxes { x: number; y: number; z: number; set(x?: number, y?: number, z?: number): void; }
interface FakeRenderer {
  render: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setPixelRatio: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  domElement: HTMLElement;
}

// The mock module contents must be created inside vi.hoisted because the
// vi.mock factory is hoisted above ordinary module-level declarations.
const threeMock = vi.hoisted(() => {
  const renderers: FakeRenderer[] = [];
  const meshes: Array<{ rotation: { x: number; y: number; z: number } }> = [];

  function makeAxes(): FakeAxes {
    return {
      x: 0, y: 0, z: 0,
      set(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; },
    };
  }

  class FakeObject3D {
    position = makeAxes();
    rotation = makeAxes();
    scale = makeAxes();
    children: FakeObject3D[] = [];
    add(...objs: FakeObject3D[]) { this.children.push(...objs); }
    traverse(cb: (o: FakeObject3D) => void) {
      const walk = (o: FakeObject3D) => { cb(o); o.children.forEach(walk); };
      walk(this);
    }
  }

  // Only real Meshes (rotating content) are tracked — lights/helpers share
  // the plain FakeObject3D.
  class FakeMesh extends FakeObject3D {
    constructor() {
      super();
      meshes.push(this);
    }
  }

  class FakeScene extends FakeObject3D {
    background: unknown = null;
  }

  class FakeCamera extends FakeObject3D {
    fov: number;
    aspect = 1;
    constructor(fov = 50) { super(); this.fov = fov; }
    lookAt = vi.fn();
    updateProjectionMatrix = vi.fn();
  }

  class FakeGeometry {
    attributes: Record<string, unknown> = {};
    setAttribute(name: string, attr: unknown) { this.attributes[name] = attr; }
    dispose = vi.fn();
  }

  class FakeMaterial { dispose = vi.fn(); }

  class FakeColor { value: unknown; constructor(v?: unknown) { this.value = v; } }

  class FakeWebGLRenderer {
    domElement: HTMLElement;
    shadowMap = { enabled: false };
    render = vi.fn();
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    dispose = vi.fn();
    constructor() {
      this.domElement = document.createElement('canvas');
      renderers.push(this as unknown as FakeRenderer);
    }
  }

  class FakeBufferAttribute { constructor(public array: unknown, public itemSize: number) {} }

  const exports = {
    Scene: FakeScene,
    Color: FakeColor,
    PerspectiveCamera: FakeCamera,
    WebGLRenderer: FakeWebGLRenderer,
    BufferAttribute: FakeBufferAttribute,
    BufferGeometry: FakeGeometry,
    Object3D: FakeObject3D,
    Mesh: FakeMesh,
    Line: FakeObject3D,
    LineSegments: FakeObject3D,
    Points: FakeObject3D,
    GridHelper: FakeObject3D,
    AxesHelper: FakeObject3D,
    AmbientLight: FakeObject3D,
    DirectionalLight: FakeObject3D,
    PointLight: FakeObject3D,
    HemisphereLight: FakeObject3D,
    SpotLight: FakeObject3D,
    BoxGeometry: FakeGeometry,
    SphereGeometry: FakeGeometry,
    CylinderGeometry: FakeGeometry,
    ConeGeometry: FakeGeometry,
    TorusGeometry: FakeGeometry,
    TorusKnotGeometry: FakeGeometry,
    PlaneGeometry: FakeGeometry,
    RingGeometry: FakeGeometry,
    EdgesGeometry: FakeGeometry,
    LineBasicMaterial: FakeMaterial,
    PointsMaterial: FakeMaterial,
    MeshStandardMaterial: FakeMaterial,
    __renderers: renderers,
    __meshes: meshes,
    __reset: () => { renderers.length = 0; meshes.length = 0; },
  };

  return { exports, renderers, meshes };
});

vi.mock('three', () => threeMock.exports);

const mockThree = THREE as unknown as {
  __renderers: FakeRenderer[];
  __meshes: Array<{ rotation: { x: number; y: number; z: number } }>;
  __reset: () => void;
};

// ── rAF test harness: the loop is driven by manually pumping frames ──
let rafCallbacks: Map<number, FrameRequestCallback>;
let rafSeq = 0;

function stubFrameLoop() {
  rafSeq = 0;
  rafCallbacks = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafSeq += 1;
    rafCallbacks.set(rafSeq, cb);
    return rafSeq;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { rafCallbacks.delete(id); });
}

/** Runs every pending rAF callback once with the given timestamp. */
function tick(t: number) {
  const pending = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  for (const [, cb] of pending) cb(t);
}

function renderCount() {
  return mockThree.__renderers.reduce((n, r) => n + r.render.mock.calls.length, 0);
}

function stubObservers() {
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
  });
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
  });
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
}

const ANIMATED_DATA = {
  objects: [{ type: 'sphere', radius: 1, animate: { rotate: { y: 0.5 } } }],
  autoRotate: false,
};

beforeEach(() => {
  mockThree.__reset();
  stubFrameLoop();
  stubObservers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Remove an own-property visibilityState shadow (restores jsdom's default).
  delete (document as unknown as { visibilityState?: string }).visibilityState;
});

describe('ThreeVisual render loop', () => {
  it('caps an idle scene at ~30fps while rAF ticks at 60', () => {
    const { container } = render(<ThreeVisual data={ANIMATED_DATA} />);
    expect(container.querySelector('canvas')).not.toBeNull();

    const base = renderCount(); // 1 — the mount render
    expect(base).toBe(1);

    const t0 = performance.now();
    for (let i = 1; i <= 10; i++) tick(t0 + i * 16.7); // 10 display frames @60Hz
    // 166.7ms at a 33.3ms floor ≈ 5 frames (first tick skipped: <33ms since mount).
    const rendered = renderCount() - base;
    expect(rendered).toBeGreaterThanOrEqual(4);
    expect(rendered).toBeLessThanOrEqual(6);
  });

  it('runs at the full rAF rate during the 600ms interaction window', () => {
    render(<ThreeVisual data={ANIMATED_DATA} />);
    const canvas = document.querySelector('canvas')!;
    const t0 = performance.now();

    fireEvent.mouseDown(canvas); // pokes the interaction window
    const base = renderCount();
    for (let i = 1; i <= 10; i++) tick(t0 + i * 16.7);
    expect(renderCount() - base).toBe(10); // every display frame is rendered

    // After the window expires the 30fps cap kicks back in.
    const base2 = renderCount();
    for (let i = 1; i <= 10; i++) tick(t0 + 1000 + i * 16.7);
    const capped = renderCount() - base2;
    expect(capped).toBeGreaterThanOrEqual(3);
    expect(capped).toBeLessThanOrEqual(6);
  });

  it('scales rotation by the frame delta (fps-independent speed)', () => {
    render(<ThreeVisual data={ANIMATED_DATA} />);
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas); // full-rate window so every tick renders

    const t0 = performance.now();
    // Ticks spaced 50ms apart: with delta scaling each rendered frame steps
    // rotation by 0.5 * 0.01 * (50ms/16.67ms) ≈ 0.015 — 3× the per-frame step
    // the old fixed-speed loop produced (~0.005/frame regardless of spacing).
    for (let i = 1; i <= 6; i++) tick(t0 + i * 50);

    const rotY = mockThree.__meshes[0].rotation.y;
    // Mount render contributes one base step (~0.005); 6 scaled steps follow.
    expect(rotY).toBeGreaterThan(0.08);
    expect(rotY).toBeLessThan(0.13);
  });

  it('stops the loop when the document is hidden and resumes when visible', () => {
    render(<ThreeVisual data={ANIMATED_DATA} />);
    expect(rafCallbacks.size).toBe(1); // loop pending

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks.size).toBe(0); // loop cancelled

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks.size).toBe(1); // loop resumed
    const t0 = performance.now();
    tick(t0 + 16); // skipped (<33ms since resume)
    tick(t0 + 50); // crosses the 33ms floor → renders
    expect(renderCount()).toBeGreaterThanOrEqual(3); // mount + 2 post-resume frames
  });

  it('tears down the loop and GPU resources on unmount', () => {
    const { unmount } = render(<ThreeVisual data={ANIMATED_DATA} />);
    expect(rafCallbacks.size).toBe(1);
    unmount();
    expect(rafCallbacks.size).toBe(0); // frame cancelled
    expect(mockThree.__renderers[0].dispose).toHaveBeenCalled();
    expect(mockThree.__renderers[0].render.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

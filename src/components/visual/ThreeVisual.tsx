import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

const ThreeVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, copy] = useCopy();

  const sceneData = data as Record<string, unknown>;
  const objects = useMemo(() => (sceneData.objects as Array<Record<string, unknown>>) || [], [sceneData.objects]);
  const lights = useMemo(() => (sceneData.lights as Array<Record<string, unknown>>) || [], [sceneData.lights]);

  const hex = (c?: string): number => c ? parseInt(c.replace('#', ''), 16) : 0xa855f7;

  const initScene = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight || 400;
    const bg = (sceneData.backgroundColor as string) || '#0f0f13';
    const cam = (sceneData.camera as Record<string, unknown>) || {};
    const camPos = (cam.position as [number, number, number]) || [4, 3, 5];
    const camFov = (cam.fov as number) || 50;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bg);

    const camera = new THREE.PerspectiveCamera(camFov, w / h, 0.1, 1000);
    camera.position.set(camPos[0], camPos[1], camPos[2]);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    if (sceneData.grid !== false) {
      const grid = new THREE.GridHelper(10, 10, 0x444466, 0x333355);
      grid.position.y = -2;
      scene.add(grid);
    }

    if (sceneData.axes) {
      scene.add(new THREE.AxesHelper(3));
    }

    if (lights.length === 0) {
      scene.add(new THREE.AmbientLight(0x404060, 0.5));
      const dir = new THREE.DirectionalLight(0xffffff, 1);
      dir.position.set(5, 10, 7);
      scene.add(dir);
      const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
      fill.position.set(-3, 1, -2);
      scene.add(fill);
    } else {
      for (const l of lights) {
        const lc = hex(l.color as string);
        const li = (l.intensity as number) ?? 1;
        const lt = l.type as string;
        if (lt === 'ambient') scene.add(new THREE.AmbientLight(lc, li));
        else if (lt === 'directional') {
          const d = new THREE.DirectionalLight(lc, li);
          if (l.position) d.position.set(...(l.position as [number, number, number]));
          scene.add(d);
        } else if (lt === 'point') {
          const p = new THREE.PointLight(lc, li, (l.distance as number) || 100, (l.decay as number) || 2);
          if (l.position) p.position.set(...(l.position as [number, number, number]));
          scene.add(p);
        } else if (lt === 'hemisphere') {
          scene.add(new THREE.HemisphereLight((l.color ? hex(l.color as string) : 0x87ceeb), 0x444444, li));
        } else if (lt === 'spot') {
          const s = new THREE.SpotLight(lc, li, (l.distance as number) || 100, (l.angle as number) || Math.PI / 6, (l.penumbra as number) || 0.1, (l.decay as number) || 1);
          if (l.position) s.position.set(...(l.position as [number, number, number]));
          scene.add(s);
        }
      }
    }

    const meshes: Array<{ mesh: THREE.Object3D; animate?: Record<string, unknown>; initialY?: number }> = [];

    const add = (m: THREE.Object3D, o: Record<string, unknown>) => {
      const pos = o.position as [number, number, number] | undefined;
      const rot = o.rotation as [number, number, number] | undefined;
      const scl = o.scale as [number, number, number] | undefined;
      if (pos) m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      if (scl) m.scale.set(scl[0], scl[1], scl[2]);
      scene.add(m);
      meshes.push({ mesh: m, animate: o.animate as Record<string, unknown>, initialY: pos?.[1] || 0 });
    };

    for (const obj of objects) {
      const c = hex(obj.color as string);
      const op = (obj.opacity ?? 1) as number;
      const segs = (obj.segments as number) || 32;
      const type = obj.type as string;

      let geo: THREE.BufferGeometry;
      switch (type) {
        case 'box':
          geo = new THREE.BoxGeometry((obj.width as number) || 1, (obj.height as number) || 1, (obj.depth as number) || 1); break;
        case 'sphere':
          geo = new THREE.SphereGeometry((obj.radius as number) || 0.5, segs, segs); break;
        case 'cylinder':
          geo = new THREE.CylinderGeometry((obj.radiusTop ?? obj.radius ?? 0.5) as number, (obj.radiusBottom ?? obj.radius ?? 0.5) as number, (obj.height as number) || 1, segs); break;
        case 'cone':
          geo = new THREE.ConeGeometry((obj.radius as number) || 0.5, (obj.height as number) || 1, segs); break;
        case 'torus':
          geo = new THREE.TorusGeometry((obj.radius as number) || 0.5, (obj.tube as number) || 0.2, segs, (obj.tubularSegments as number) || segs, (obj.arc as number) || Math.PI * 2); break;
        case 'torusKnot':
          geo = new THREE.TorusKnotGeometry((obj.radius as number) || 0.5, (obj.tube as number) || 0.2, segs * 2, (obj.tubularSegments as number) || segs); break;
        case 'plane':
          geo = new THREE.PlaneGeometry((obj.width as number) || 2, (obj.height as number) || 2); break;
        case 'ring':
          geo = new THREE.RingGeometry((obj.radiusInner as number) || 0.3, (obj.radius as number) || 0.6, segs); break;
        case 'line':
        case 'points': {
          const pts = (obj.points as [number, number, number][]) || [];
          const arr = new Float32Array(pts.flat());
          geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
          break;
        }
        default:
          geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      }

      if (type === 'line') {
        const mat = new THREE.LineBasicMaterial({ color: c });
        add(new THREE.Line(geo, mat), obj);
      } else if (type === 'points') {
        const mat = new THREE.PointsMaterial({ color: c, size: 0.1 });
        add(new THREE.Points(geo, mat), obj);
      } else {
        const opts: Record<string, unknown> = { color: c, transparent: op < 1, opacity: op, wireframe: !!obj.wireframe, roughness: 0.4, metalness: 0.1, flatShading: !!obj.flatShading };
        if (obj.emissive) { opts.emissive = new THREE.Color(obj.emissive as string); opts.emissiveIntensity = 0.3; }
        const mat = new THREE.MeshStandardMaterial(opts as THREE.MeshStandardMaterialParameters);
        const mesh = new THREE.Mesh(geo, mat);
        if (obj.edges) {
          const eMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
          const eGeo = new THREE.EdgesGeometry(geo);
          mesh.add(new THREE.LineSegments(eGeo, eMat));
        }
        add(mesh, obj);
      }
    }

    const orbit = {
      dragging: false, px: 0, py: 0,
      theta: Math.atan2(camPos[0], camPos[2]),
      phi: Math.atan2(camPos[1], Math.sqrt(camPos[0] * camPos[0] + camPos[2] * camPos[2])),
      radius: Math.sqrt(camPos[0] ** 2 + camPos[1] ** 2 + camPos[2] ** 2),
    };
    const updateCam = () => {
      camera.position.x = orbit.radius * Math.cos(orbit.phi) * Math.sin(orbit.theta);
      camera.position.y = orbit.radius * Math.sin(orbit.phi);
      camera.position.z = orbit.radius * Math.cos(orbit.phi) * Math.cos(orbit.theta);
      camera.lookAt(0, 0, 0);
    };

    const el = renderer.domElement;
    el.addEventListener('mousedown', (e: MouseEvent) => { orbit.dragging = true; orbit.px = e.clientX; orbit.py = e.clientY; });
    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!orbit.dragging) return;
      orbit.theta -= (e.clientX - orbit.px) * 0.005;
      orbit.phi = Math.max(-1.5, Math.min(1.5, orbit.phi + (e.clientY - orbit.py) * 0.005));
      orbit.px = e.clientX; orbit.py = e.clientY; updateCam();
    });
    window.addEventListener('mouseup', () => { orbit.dragging = false; });
    el.addEventListener('wheel', (e: WheelEvent) => { e.preventDefault(); orbit.radius = Math.max(1, Math.min(50, orbit.radius + e.deltaY * 0.01)); updateCam(); }, { passive: false });
    el.addEventListener('touchstart', (e: TouchEvent) => { if (e.touches.length === 1) { orbit.dragging = true; orbit.px = e.touches[0].clientX; orbit.py = e.touches[0].clientY; } }, { passive: true });
    el.addEventListener('touchmove', (e: TouchEvent) => {
      if (!orbit.dragging || e.touches.length !== 1) return;
      orbit.theta -= (e.touches[0].clientX - orbit.px) * 0.005;
      orbit.phi = Math.max(-1.5, Math.min(1.5, orbit.phi + (e.touches[0].clientY - orbit.py) * 0.005));
      orbit.px = e.touches[0].clientX; orbit.py = e.touches[0].clientY; updateCam();
    }, { passive: true });
    el.addEventListener('touchend', () => { orbit.dragging = false; }, { passive: true });

    let frameId: number;
    const start = Date.now();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = (Date.now() - start) / 1000;
      for (const entry of meshes) {
        const a = entry.animate;
        if (!a) continue;
        const m = entry.mesh;
        const rot = a.rotate as Record<string, unknown> | undefined;
        if (rot) {
          if (rot.x) m.rotation.x += (rot.x as number) * 0.01;
          if (rot.y) m.rotation.y += (rot.y as number) * 0.01;
          if (rot.z) m.rotation.z += (rot.z as number) * 0.01;
        }
        if (a.bob && entry.initialY !== undefined) m.position.y = entry.initialY + Math.sin(t * (a.bob as number)) * 0.3;
        if (a.pulse) { const s = 1 + Math.sin(t * 2) * 0.1; m.scale.x = s; m.scale.y = s; m.scale.z = s; }
      }
      if (sceneData.autoRotate) { orbit.theta += 0.003; updateCam(); }
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const cw = container.clientWidth;
      const ch = container.clientHeight || 400;
      camera.aspect = cw / ch; camera.updateProjectionMatrix(); renderer.setSize(cw, ch);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(frameId); ro.disconnect();
      if (container.contains(el)) container.removeChild(el);
      renderer.dispose();
    };
  }, [objects, lights, sceneData]);

  useEffect(() => {
    const cleanup = initScene();
    return () => { if (cleanup) cleanup(); };
  }, [initScene]);

  return (
    <VisualCard
      title={(sceneData.title as string) || '3D Scene'}
      onCopy={() => copy(JSON.stringify(data, null, 2))}
      copied={copied}
      expanded={expanded}
      onToggle={() => setExpanded(v => !v)}
    >
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height: expanded ? '600px' : '400px', background: (sceneData.backgroundColor as string) || '#0f0f13' }}
      />
    </VisualCard>
  );
};

export default ThreeVisual;

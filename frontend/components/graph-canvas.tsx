'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { FACET_LINKS, FACET_NODES, type FacetNode } from '@/lib/graph-data';

type GraphCanvasProps = {
  selectedId?: string;
  onSelect: (node: FacetNode) => void;
};

const CUBE: [number, number, number][] = [
  [1, 1, 1],
  [1, 1, -1],
  [1, -1, 1],
  [-1, 1, 1],
  [-1, -1, 1],
  [-1, 1, -1],
  [1, -1, -1],
  [-1, -1, -1],
];

const SPAN = 28;
const CORE_R = 6.6;
const SAT_R = 4.1;
const CYAN = 0x67e8f9;
const AMBER = 0xfbbf24;

function nodeRadius(id: string) {
  return id === 'you' ? CORE_R : SAT_R;
}

function layout(): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>();
  map.set('you', new THREE.Vector3(0, 0, 0));
  FACET_NODES.filter((node) => node.id !== 'you').forEach((node, i) => {
    const [x, y, z] = CUBE[i % CUBE.length];
    map.set(node.id, new THREE.Vector3(x, y, z).normalize().multiplyScalar(SPAN));
  });
  return map;
}

function shellMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x1c5366,
    metalness: 0.28,
    roughness: 0.24,
    transmission: 0.18,
    thickness: 0.9,
    transparent: true,
    opacity: 0.9,
    emissive: 0x0e4454,
    emissiveIntensity: 1.05,
  });
}

function coreMaterial(selected: boolean) {
  return new THREE.MeshBasicMaterial({
    color: selected ? AMBER : CYAN,
    transparent: true,
    opacity: 0.95,
  });
}

function makeBeam(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, material: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = Math.max(dir.length() - ra - rb, 0.01);
  const geom = new THREE.CylinderGeometry(0.22, 0.22, length, 10);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function starfield() {
  const count = 420;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 220;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 160;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 220;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geom,
    new THREE.PointsMaterial({ color: 0x8fb4c8, size: 0.35, transparent: true, opacity: 0.55 }),
  );
}

export default function GraphCanvas({ selectedId, onSelect }: GraphCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const applySelectRef = useRef<(id?: string) => void>(() => undefined);

  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;

  useEffect(() => {
    applySelectRef.current(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const positions = layout();
    const byId = new Map(FACET_NODES.map((node) => [node.id, node]));
    const shells = new Map<string, THREE.Mesh>();
    const cores = new Map<string, THREE.Mesh>();
    const groups = new Map<string, THREE.Group>();
    const labels = new Map<string, HTMLDivElement>();
    let hoveredId: string | undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04070c);
    scene.fog = new THREE.FogExp2(0x04070c, 0.012);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
    camera.position.set(62, 22, 74);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    wrap.appendChild(renderer.domElement);

    const labelsRenderer = new CSS2DRenderer();
    labelsRenderer.domElement.className = 'hub-labels';
    wrap.appendChild(labelsRenderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.62, 0.12);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    scene.add(new THREE.HemisphereLight(0x4d7a96, 0x05070a, 0.55));
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.65);
    rim.position.set(-20, 18, 12);
    scene.add(rim);
    scene.add(new THREE.PointLight(CYAN, 3.2, 110, 2));
    scene.add(starfield());

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x3ec6d8,
      transparent: true,
      opacity: 0.7,
    });
    const cell = new THREE.Group();
    scene.add(cell);

    for (const node of FACET_NODES) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const radius = nodeRadius(node.id);
      const group = new THREE.Group();
      group.position.copy(pos);
      group.userData.id = node.id;

      const shell = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 28), shellMaterial());
      shell.userData.id = node.id;
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.52, 24, 16),
        coreMaterial(node.id === selectedRef.current),
      );
      core.userData.id = node.id;

      const el = document.createElement('div');
      el.className = 'hub-label';
      el.textContent = node.name;
      if (node.id === selectedRef.current) el.classList.add('is-selected');
      const label = new CSS2DObject(el);
      label.position.set(0, -(radius + (node.id === 'you' ? 2.8 : 1.35)), 0);

      group.add(shell, core, label);
      cell.add(group);
      shells.set(node.id, shell);
      cores.set(node.id, core);
      groups.set(node.id, group);
      labels.set(node.id, el);
    }

    for (const link of FACET_LINKS) {
      const a = positions.get(link.source);
      const b = positions.get(link.target);
      if (!a || !b) continue;
      cell.add(makeBeam(a, b, nodeRadius(link.source), nodeRadius(link.target), beamMat));
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.42;
    controls.minDistance = 40;
    controls.maxDistance = 120;
    controls.target.set(0, 0, 0);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const paint = (id?: string, hot?: string) => {
      cores.forEach((core, meshId) => {
        const mat = core.material;
        if (mat instanceof THREE.MeshBasicMaterial) {
          mat.color.setHex(meshId === id ? AMBER : CYAN);
        }
        labels.get(meshId)?.classList.toggle('is-selected', meshId === id);
        labels.get(meshId)?.classList.toggle('is-hot', meshId === hot && meshId !== id);
      });
    };
    applySelectRef.current = (id?: string) => paint(id, hoveredId);

    const resize = () => {
      const width = wrap.clientWidth || 1;
      const height = wrap.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
      bloom.setSize(width, height);
      labelsRenderer.setSize(width, height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const pick = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...shells.values(), ...cores.values()], false);
      return hits[0]?.object.userData.id as string | undefined;
    };

    const onPointerMove = (event: PointerEvent) => {
      hoveredId = pick(event.clientX, event.clientY);
      wrap.style.cursor = hoveredId ? 'pointer' : 'grab';
      paint(selectedRef.current, hoveredId);
    };
    const onClick = (event: PointerEvent) => {
      const id = pick(event.clientX, event.clientY);
      if (!id) return;
      const node = byId.get(id);
      if (node) onSelectRef.current(node);
    };

    wrap.addEventListener('pointermove', onPointerMove);
    wrap.addEventListener('click', onClick);

    const clock = new THREE.Clock();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      groups.forEach((group, id) => {
        const active = id === selectedRef.current || id === hoveredId;
        const pulse = 1 + (active ? 0.07 + 0.03 * Math.sin(t * 5) : 0.015 * Math.sin(t * 2 + group.position.x));
        group.scale.setScalar(pulse);
        const core = cores.get(id);
        if (core) core.scale.setScalar(0.92 + 0.08 * Math.sin(t * 3.2 + group.position.y));
      });
      controls.update();
      composer.render();
      labelsRenderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('click', onClick);
      controls.dispose();
      composer.dispose();
      cell.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((item) => item.dispose());
          else if (mat instanceof THREE.Material) mat.dispose();
        }
      });
      scene.traverse((obj) => {
        if (obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
        }
      });
      beamMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelsRenderer.domElement.remove();
      labels.forEach((el) => el.remove());
    };
  }, []);

  return <div ref={wrapRef} className="graph-canvas" />;
}

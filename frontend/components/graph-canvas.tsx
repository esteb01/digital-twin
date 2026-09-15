'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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

const SPAN = 26;
const CORE_R = 7.2;
const SAT_R = 4.55;

function nodeRadius(id: string) {
  return id === 'you' ? CORE_R : SAT_R;
}

function layout(): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>();
  map.set('you', new THREE.Vector3(0, 0, 0));
  const satellites = FACET_NODES.filter((node) => node.id !== 'you');
  satellites.forEach((node, i) => {
    const [x, y, z] = CUBE[i % CUBE.length];
    map.set(node.id, new THREE.Vector3(x, y, z).normalize().multiplyScalar(SPAN));
  });
  return map;
}

function chromeMaterial(selected: boolean, isCore: boolean) {
  return new THREE.MeshPhysicalMaterial({
    color: selected ? 0xf3e6c4 : isCore ? 0xeef2f6 : 0xc5cdd6,
    metalness: 0.94,
    roughness: selected ? 0.28 : 0.2,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
    emissive: selected ? 0x4a3414 : 0x101820,
    emissiveIntensity: selected ? 0.32 : 0.06,
  });
}

function makeStrut(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, material: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = Math.max(dir.length() - ra - rb, 0.01);
  const geom = new THREE.CylinderGeometry(0.72, 0.72, length, 14);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = false;
  return mesh;
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
    const meshes = new Map<string, THREE.Mesh>();
    const labels = new Map<string, HTMLDivElement>();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071018);
    scene.fog = new THREE.Fog(0x071018, 70, 140);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    camera.position.set(56, 30, 68);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    wrap.appendChild(renderer.domElement);

    const labelsRenderer = new CSS2DRenderer();
    labelsRenderer.domElement.className = 'atomium-labels';
    wrap.appendChild(labelsRenderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    scene.add(new THREE.HemisphereLight(0xb9c9d8, 0x1a140c, 0.7));
    const key = new THREE.DirectionalLight(0xf2f5f8, 2.1);
    key.position.set(18, 32, 20);
    scene.add(key);
    const coreGlow = new THREE.PointLight(0xd7dee6, 1.4, 80);
    scene.add(coreGlow);

    const strutMat = new THREE.MeshPhysicalMaterial({
      color: 0x8d99a6,
      metalness: 0.88,
      roughness: 0.32,
    });

    const cell = new THREE.Group();
    scene.add(cell);

    for (const node of FACET_NODES) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const radius = nodeRadius(node.id);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 48, 32),
        chromeMaterial(node.id === selectedRef.current, node.id === 'you'),
      );
      mesh.position.copy(pos);
      mesh.userData.id = node.id;
      meshes.set(node.id, mesh);
      cell.add(mesh);

      const el = document.createElement('div');
      el.className = 'atomium-label';
      el.textContent = node.name;
      if (node.id === selectedRef.current) el.classList.add('is-selected');
      labels.set(node.id, el);
      const label = new CSS2DObject(el);
      label.position.set(0, -(radius + (node.id === 'you' ? 2.6 : 1.1)), 0);
      mesh.add(label);
    }

    for (const link of FACET_LINKS) {
      const a = positions.get(link.source);
      const b = positions.get(link.target);
      if (!a || !b) continue;
      cell.add(makeStrut(a, b, nodeRadius(link.source), nodeRadius(link.target), strutMat));
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controls.minDistance = 36;
    controls.maxDistance = 110;
    controls.target.set(0, 0, 0);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const applySelect = (id?: string) => {
      meshes.forEach((mesh, meshId) => {
        const mat = mesh.material;
        if (mat instanceof THREE.MeshPhysicalMaterial) mat.dispose();
        mesh.material = chromeMaterial(meshId === id, meshId === 'you');
        labels.get(meshId)?.classList.toggle('is-selected', meshId === id);
      });
    };
    applySelectRef.current = applySelect;

    const resize = () => {
      const width = wrap.clientWidth || 1;
      const height = wrap.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
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
      const hits = raycaster.intersectObjects([...meshes.values()], false);
      return hits[0]?.object.userData.id as string | undefined;
    };

    const onPointerMove = (event: PointerEvent) => {
      wrap.style.cursor = pick(event.clientX, event.clientY) ? 'pointer' : 'grab';
    };
    const onClick = (event: PointerEvent) => {
      const id = pick(event.clientX, event.clientY);
      if (!id) return;
      const node = byId.get(id);
      if (node) onSelectRef.current(node);
    };

    wrap.addEventListener('pointermove', onPointerMove);
    wrap.addEventListener('click', onClick);

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
      labelsRenderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('click', onClick);
      controls.dispose();
      pmrem.dispose();
      cell.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
        }
      });
      strutMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelsRenderer.domElement.remove();
      labels.forEach((el) => el.remove());
    };
  }, []);

  return <div ref={wrapRef} className="graph-canvas" />;
}

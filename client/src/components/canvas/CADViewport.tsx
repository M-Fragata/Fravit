import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useBIM } from '../../cad-core/engine/bimStore';
import type { Point2D, WallElement } from '../../cad-core/types';
import { CanvasOverlay } from './CanvasOverlay';

interface CADViewportProps {
  onCursorMove?: (worldPos: Point2D) => void;
}

export const CADViewport: React.FC<CADViewportProps> = ({ onCursorMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const threeMountRef = useRef<HTMLDivElement>(null);
  const state = useBIM();
  const { activeView, elements } = state;

  // Transformações da Câmera 2D (Pan & Zoom)
  const [zoom2D, setZoom2D] = useState<number>(60); // pixels por metro
  const [pan2D, setPan2D] = useState<Point2D>({ x: 0, y: 0 });

  // Referências Three.js
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const perspCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const wallGroupRef = useRef<THREE.Group | null>(null);

  // Estados de navegação 3D (Orbit)
  const orbitRef = useRef({
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 18,
    target: new THREE.Vector3(0, 0, 1.4),
    isDragging: false,
    lastMouse: { x: 0, y: 0 },
  });

  // 1. Inicializar Three.js Engine
  useEffect(() => {
    if (!threeMountRef.current || !containerRef.current) return;
    const mount = threeMountRef.current;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    // Renderer com correção de ShadowMap para versões modernas do Three.js
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // Substitui PCFSoftShadowMap obsoleto
    renderer.localClippingEnabled = true;

    // Montar no sub-container dedicado (sem apagar React)
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d14);
    sceneRef.current = scene;

    // Câmera Ortográfica 2D (Top-Down)
    const aspect = width / height;
    const frustumSize = height / zoom2D;
    const orthoCam = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    orthoCam.position.set(pan2D.x, pan2D.y, 200);
    orthoCam.lookAt(pan2D.x, pan2D.y, 0);
    orthoCam.up.set(0, 1, 0);
    orthoCameraRef.current = orthoCam;

    // Câmera Perspectiva 3D
    const perspCam = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    perspCam.up.set(0, 0, 1);
    perspCameraRef.current = perspCam;

    // Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(15, 20, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    fillLight.position.set(-15, -15, 10);
    scene.add(fillLight);

    // Grupo de Paredes
    const wallGroup = new THREE.Group();
    scene.add(wallGroup);
    wallGroupRef.current = wallGroup;

    // Grid e Eixos 3D
    const grid3D = new THREE.GridHelper(50, 50, 0x38bdf8, 0x1f293d);
    grid3D.rotation.x = Math.PI / 2;
    grid3D.position.z = -0.01;
    scene.add(grid3D);

    const axesHelper = new THREE.AxesHelper(2);
    scene.add(axesHelper);

    // Loop de Renderização
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (activeView === '3d') {
        const o = orbitRef.current;
        perspCam.position.x = o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta);
        perspCam.position.y = o.target.y + o.radius * Math.sin(o.phi) * Math.cos(o.theta);
        perspCam.position.z = o.target.z + o.radius * Math.cos(o.phi);
        perspCam.lookAt(o.target);
        renderer.render(scene, perspCam);
      } else {
        orthoCam.position.set(pan2D.x, pan2D.y, 200);
        orthoCam.lookAt(pan2D.x, pan2D.y, 0);
        renderer.render(scene, orthoCam);
      }
    };
    animate();

    // Redimensionamento
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const newAspect = w / h;

      renderer.setSize(w, h);

      const newFrustum = h / zoom2D;
      orthoCam.left = (-newFrustum * newAspect) / 2;
      orthoCam.right = (newFrustum * newAspect) / 2;
      orthoCam.top = newFrustum / 2;
      orthoCam.bottom = -newFrustum / 2;
      orthoCam.updateProjectionMatrix();

      perspCam.aspect = newAspect;
      perspCam.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [activeView]);

  // 2. Atualizar Parâmetros da Câmera 2D ao mudar Zoom e Pan
  useEffect(() => {
    if (!orthoCameraRef.current || !containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    const aspect = w / h;
    const frustumSize = h / zoom2D;

    const cam = orthoCameraRef.current;
    cam.left = (-frustumSize * aspect) / 2;
    cam.right = (frustumSize * aspect) / 2;
    cam.top = frustumSize / 2;
    cam.bottom = -frustumSize / 2;
    cam.position.set(pan2D.x, pan2D.y, 200);
    cam.lookAt(pan2D.x, pan2D.y, 0);
    cam.updateProjectionMatrix();
  }, [zoom2D, pan2D]);

  // 3. Reconstruir Geometria 3D e 2D das Paredes com Alto Contraste
  useEffect(() => {
    if (!wallGroupRef.current) return;
    const group = wallGroupRef.current;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }

    const wall3DMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.5,
      metalness: 0.1,
    });

    const edgeMaterial3D = new THREE.LineBasicMaterial({
      color: 0x1e293b,
      linewidth: 2,
    });

    // Material 2D com preenchimento cinza e bordas nítidas
    const wall2DMaterial = new THREE.MeshBasicMaterial({
      color: 0x334155,
    });

    const edgeMaterial2D = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      linewidth: 2,
    });

    elements.walls.forEach((wall: WallElement) => {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.01) return;

      const angle = Math.atan2(dy, dx);
      const midX = (wall.start.x + wall.end.x) / 2;
      const midY = (wall.start.y + wall.end.y) / 2;
      const midZ = wall.height / 2;

      const geom = new THREE.BoxGeometry(length, wall.thickness, wall.height);
      const mesh = new THREE.Mesh(geom, activeView === '3d' ? wall3DMaterial : wall2DMaterial);
      mesh.position.set(midX, midY, midZ);
      mesh.rotation.z = angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Bordas destacadas tanto no 2D quanto no 3D
      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(edges, activeView === '3d' ? edgeMaterial3D : edgeMaterial2D);
      mesh.add(line);

      group.add(mesh);
    });
  }, [elements.walls, activeView]);

  // 4. Listener de Wheel não-passivo para evitar erro de preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (activeView === '3d') {
        const factor = e.deltaY > 0 ? 1.1 : 0.9;
        orbitRef.current.radius = Math.max(2, Math.min(80, orbitRef.current.radius * factor));
      } else {
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const newZoom = Math.max(10, Math.min(300, zoom2D * zoomFactor));

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const worldMouseBeforeX = pan2D.x + mouseX / zoom2D;
        const worldMouseBeforeY = pan2D.y - mouseY / zoom2D;

        const newPanX = worldMouseBeforeX - mouseX / newZoom;
        const newPanY = worldMouseBeforeY + mouseY / newZoom;

        setZoom2D(newZoom);
        setPan2D({ x: newPanX, y: newPanY });
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [activeView, zoom2D, pan2D]);

  // Conversores de Coordenadas: Tela <-> Mundo
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point2D => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const relX = screenX - rect.left;
      const relY = screenY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const worldX = pan2D.x + (relX - centerX) / zoom2D;
      const worldY = pan2D.y - (relY - centerY) / zoom2D;

      return { x: worldX, y: worldY };
    },
    [pan2D, zoom2D]
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number): Point2D => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const screenX = centerX + (worldX - pan2D.x) * zoom2D;
      const screenY = centerY - (worldY - pan2D.y) * zoom2D;

      return { x: screenX, y: screenY };
    },
    [pan2D, zoom2D]
  );

  // Manipulação de Mouse no modo 3D
  const handleMouseDown3D = (e: React.MouseEvent) => {
    if (activeView === '3d' && e.button === 0) {
      orbitRef.current.isDragging = true;
      orbitRef.current.lastMouse = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove3D = (e: React.MouseEvent) => {
    if (orbitRef.current.isDragging && activeView === '3d') {
      const dx = e.clientX - orbitRef.current.lastMouse.x;
      const dy = e.clientY - orbitRef.current.lastMouse.y;
      orbitRef.current.theta -= dx * 0.008;
      orbitRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, orbitRef.current.phi - dy * 0.008));
      orbitRef.current.lastMouse = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp3D = () => {
    orbitRef.current.isDragging = false;
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleMouseDown3D}
      onMouseMove={handleMouseMove3D}
      onMouseUp={handleMouseUp3D}
    >
      {/* Subcontainer isolado para o WebGL do Three.js */}
      <div
        ref={threeMountRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Overlay 2D Interativo (Snaps, Pan/Zoom e Desenho de Paredes) */}
      {activeView !== '3d' && (
        <CanvasOverlay
          zoom={zoom2D}
          pan={pan2D}
          setPan={setPan2D}
          screenToWorld={screenToWorld}
          worldToScreen={worldToScreen}
          onCursorMove={onCursorMove}
        />
      )}
    </div>
  );
};

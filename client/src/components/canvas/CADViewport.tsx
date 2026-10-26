import React, { useRef, useEffect, useCallback, useState } from 'react';
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

  // Refs mutáveis para garantir sincronização de alta precisão entre Three.js e CanvasOverlay (evitando closure staleness)
  const panRef = useRef<Point2D>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(60); // pixels por metro

  // Estado de renderização para acionar re-render do overlay quando pan/zoom mudar
  const [, setViewportTick] = useState<number>(0);
  const triggerRender = useCallback(() => setViewportTick((t) => (t + 1) % 1000000), []);

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

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.localClippingEnabled = true;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d14);
    sceneRef.current = scene;

    // Câmera Ortográfica 2D (Top-Down)
    const aspect = width / height;
    const frustumSize = height / zoomRef.current;
    const orthoCam = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    orthoCam.position.set(panRef.current.x, panRef.current.y, 200);
    orthoCam.lookAt(panRef.current.x, panRef.current.y, 0);
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
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    fillLight.position.set(-15, -15, 10);
    scene.add(fillLight);

    // Grupo de Paredes
    const wallGroup = new THREE.Group();
    scene.add(wallGroup);
    wallGroupRef.current = wallGroup;

    // Grid técnico suave (sem linha central brilhante que cruza o mapa todo)
    const grid3D = new THREE.GridHelper(60, 60, 0x1e293b, 0x162032);
    grid3D.rotation.x = Math.PI / 2;
    grid3D.position.z = -0.01;
    scene.add(grid3D);

    // Eixos Cartesianos compactos: estendem-se por 5 quadrados (5 metros) em cada direção
    const axisGroup = new THREE.Group();

    // Eixo X: -5m a +5m (vermelho)
    const xPoints = [new THREE.Vector3(-5, 0, 0.01), new THREE.Vector3(5, 0, 0.01)];
    const xGeom = new THREE.BufferGeometry().setFromPoints(xPoints);
    const xMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 });
    axisGroup.add(new THREE.Line(xGeom, xMat));

    // Eixo Y: -5m a +5m (verde)
    const yPoints = [new THREE.Vector3(0, -5, 0.01), new THREE.Vector3(0, 5, 0.01)];
    const yGeom = new THREE.BufferGeometry().setFromPoints(yPoints);
    const yMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    axisGroup.add(new THREE.Line(yGeom, yMat));

    scene.add(axisGroup);

    // Loop de Renderização com sincronização ativa de refs
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
        // Atualiza a câmera ortográfica 2D dinamicamente com base nas refs (sem atraso de closure)
        const pan = panRef.current;
        const zoom = zoomRef.current;
        const curHeight = containerRef.current?.clientHeight || 600;
        const curWidth = containerRef.current?.clientWidth || 800;
        const curAspect = curWidth / curHeight;
        const fSize = curHeight / zoom;

        orthoCam.left = (-fSize * curAspect) / 2;
        orthoCam.right = (fSize * curAspect) / 2;
        orthoCam.top = fSize / 2;
        orthoCam.bottom = -fSize / 2;
        orthoCam.position.set(pan.x, pan.y, 200);
        orthoCam.lookAt(pan.x, pan.y, 0);
        orthoCam.updateProjectionMatrix();

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

      const newFrustum = h / zoomRef.current;
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

  // 2. Reconstruir Geometria 3D e 2D das Paredes com Alto Contraste
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

    const wall2DMaterial = new THREE.MeshBasicMaterial({
      color: 0x334155,
    });

    const edgeMaterial2D = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
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

      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(edges, activeView === '3d' ? edgeMaterial3D : edgeMaterial2D);
      mesh.add(line);

      group.add(mesh);
    });
  }, [elements.walls, activeView]);

  // 3. Listener nativo de Wheel (sem aviso de passive event listener)
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
        const oldZoom = zoomRef.current;
        const newZoom = Math.max(10, Math.min(300, oldZoom * zoomFactor));

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const worldMouseBeforeX = panRef.current.x + mouseX / oldZoom;
        const worldMouseBeforeY = panRef.current.y - mouseY / oldZoom;

        panRef.current.x = worldMouseBeforeX - mouseX / newZoom;
        panRef.current.y = worldMouseBeforeY + mouseY / newZoom;
        zoomRef.current = newZoom;

        triggerRender();
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [activeView, triggerRender]);

  // Conversores de Coordenadas: Tela <-> Mundo (baseados em refs em tempo real)
  const screenToWorld = useCallback((screenX: number, screenY: number): Point2D => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const relX = screenX - rect.left;
    const relY = screenY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const worldX = panRef.current.x + (relX - centerX) / zoomRef.current;
    const worldY = panRef.current.y - (relY - centerY) / zoomRef.current;

    return { x: worldX, y: worldY };
  }, []);

  const worldToScreen = useCallback((worldX: number, worldY: number): Point2D => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const screenX = centerX + (worldX - panRef.current.x) * zoomRef.current;
    const screenY = centerY - (worldY - panRef.current.y) * zoomRef.current;

    return { x: screenX, y: screenY };
  }, []);

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
          panRef={panRef}
          zoomRef={zoomRef}
          triggerRender={triggerRender}
          screenToWorld={screenToWorld}
          worldToScreen={worldToScreen}
          onCursorMove={onCursorMove}
        />
      )}
    </div>
  );
};

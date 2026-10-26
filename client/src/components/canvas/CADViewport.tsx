import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { useBIM } from '../../cad-core/engine/bimStore';
import type { Point2D } from '../../cad-core/types';
import {
  getWallOpenings,
  getSolidWallSegments,
  analyzeWallEndpoint,
} from '../../cad-core/geometry/wallGeometry';
import { distance } from '../../cad-core/snaps/snapEngine';
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

  // 2. Reconstruir Geometria 3D e 2D de Paredes com Vãos, Portas, Janelas, Pisos, Telhados e Escadas
  useEffect(() => {
    if (!wallGroupRef.current) return;
    const group = wallGroupRef.current;

    // Limpeza profunda de malhas anteriores
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Object3D;
      group.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) {
        if (Array.isArray((child as any).material)) {
          (child as any).material.forEach((m: any) => m.dispose());
        } else {
          (child as any).material.dispose();
        }
      }
    }

    const is3D = activeView === '3d';

    // Materiais Técnicos
    const wall3DMaterial = new THREE.MeshStandardMaterial({
      color: 0xededed,
      roughness: 0.55,
      metalness: 0.05,
    });
    const wall2DMaterial = new THREE.MeshBasicMaterial({
      color: 0x223046,
    });
    const edgeMaterial3D = new THREE.LineBasicMaterial({
      color: 0x1e293b,
      linewidth: 1.5,
    });
    const edgeMaterial2D = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 2,
    });
    const sillMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.7,
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: is3D ? 0.45 : 0.8,
    });
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
    });
    const doorLeafMaterial = new THREE.MeshStandardMaterial({
      color: 0xc27803, // Tom de madeira carvalho para portas
      roughness: 0.6,
    });
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
    });
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.6,
    });
    const stairMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.5,
    });

    const addMeshWithEdges = (
      geom: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rotZ: number = 0
    ) => {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.z = rotZ;
      mesh.castShadow = is3D;
      mesh.receiveShadow = is3D;

      const edges = new THREE.EdgesGeometry(geom);
      const edgeLine = new THREE.LineSegments(edges, is3D ? edgeMaterial3D : edgeMaterial2D);
      mesh.add(edgeLine);
      group.add(mesh);
      return mesh;
    };

    // A. PISOS / LAJES (Floors)
    elements.floors.forEach((fl) => {
      if (fl.polygon.length < 3) return;
      const shape = new THREE.Shape();
      shape.moveTo(fl.polygon[0].x, fl.polygon[0].y);
      for (let i = 1; i < fl.polygon.length; i++) {
        shape.lineTo(fl.polygon[i].x, fl.polygon[i].y);
      }
      shape.closePath();

      const thickness = fl.thickness || 0.15;
      const extrudeSettings = { depth: thickness, bevelEnabled: false };
      const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const elev = (fl.elevationOffset || 0) - (is3D ? thickness : 0.05);

      const mesh = new THREE.Mesh(geom, floorMaterial);
      mesh.position.set(0, 0, elev);
      mesh.receiveShadow = is3D;

      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(edges, is3D ? edgeMaterial3D : edgeMaterial2D);
      mesh.add(line);
      group.add(mesh);
    });

    // B. TELHADOS / COBERTURAS (Roofs)
    elements.roofs.forEach((rf) => {
      if (rf.polygon.length < 3) return;
      const shape = new THREE.Shape();
      shape.moveTo(rf.polygon[0].x, rf.polygon[0].y);
      for (let i = 1; i < rf.polygon.length; i++) {
        shape.lineTo(rf.polygon[i].x, rf.polygon[i].y);
      }
      shape.closePath();

      const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
      const mesh = new THREE.Mesh(geom, roofMaterial);
      mesh.position.set(0, 0, is3D ? 2.8 : 0.1);
      mesh.castShadow = is3D;
      mesh.receiveShadow = is3D;

      const edges = new THREE.EdgesGeometry(geom);
      mesh.add(new THREE.LineSegments(edges, is3D ? edgeMaterial3D : edgeMaterial2D));
      group.add(mesh);
    });

    // C. ESCADAS PARAMÉTRICAS (Fórmula de Blondel)
    elements.stairs.forEach((st) => {
      const dx = st.end.x - st.start.x;
      const dy = st.end.y - st.start.y;
      const totalLen = Math.sqrt(dx * dx + dy * dy);
      if (totalLen < 0.2) return;

      const angle = Math.atan2(dy, dx);
      const totalRise = 2.8;
      const steps = Math.max(2, Math.round(totalRise / (st.riserHeight || 0.175)));
      const riser = totalRise / steps;
      const stepLength = totalLen / steps;
      const width = st.width || 0.9;

      for (let s = 0; s < steps; s++) {
        const distFromStart = (s + 0.5) * stepLength;
        const sx = st.start.x + (dx / totalLen) * distFromStart;
        const sy = st.start.y + (dy / totalLen) * distFromStart;

        const stepGeom = new THREE.BoxGeometry(stepLength, width, is3D ? riser * (s + 1) : 0.05);
        addMeshWithEdges(
          stepGeom,
          stairMaterial,
          sx,
          sy,
          is3D ? (riser * (s + 1)) / 2 : 0.02,
          angle
        );
      }
    });

    // D. PAREDES COM VÃOS DE PORTAS E JANELAS + DINTÉIS + PEITORIS
    elements.walls.forEach((wall) => {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      if (wallLen < 0.02) return;

      const angle = Math.atan2(dy, dx);
      const wallHeight = wall.height;
      const wallThickness = wall.thickness;
      const openings = getWallOpenings(wall, elements.doors, elements.windows);
      const solidSegments = getSolidWallSegments(wall, openings);

      // 1. Segmentos Sólidos de Alvenaria com Encontro e Preenchimento Perfeito nas Quinas
      solidSegments.forEach((seg, sIdx) => {
        const isWallStart = sIdx === 0;
        const isWallEnd = sIdx === solidSegments.length - 1;

        const startAnalysis = isWallStart
          ? analyzeWallEndpoint(wall.start, wall, elements.walls)
          : { connected: false, isDominant: false, drawCap: false, extendAmount: 0, connectedSide: 0 as const };

        const endAnalysis = isWallEnd
          ? analyzeWallEndpoint(wall.end, wall, elements.walls)
          : { connected: false, isDominant: false, drawCap: false, extendAmount: 0, connectedSide: 0 as const };

        let segStart = { ...seg.start };
        let segEnd = { ...seg.end };

        // Parede dominante estende (+T/2) para cobrir 100% da quina; parede subserviente recua (-T/2) para encostar na face interna
        if (startAnalysis.connected) {
          segStart.x -= (dx / wallLen) * startAnalysis.extendAmount;
          segStart.y -= (dy / wallLen) * startAnalysis.extendAmount;
        }
        if (endAnalysis.connected) {
          segEnd.x += (dx / wallLen) * endAnalysis.extendAmount;
          segEnd.y += (dy / wallLen) * endAnalysis.extendAmount;
        }

        const segLen = distance(segStart, segEnd);
        if (segLen < 0.02) return;

        const segMidX = (segStart.x + segEnd.x) / 2;
        const segMidY = (segStart.y + segEnd.y) / 2;

        const geom = new THREE.BoxGeometry(segLen, wallThickness, is3D ? wallHeight : 0.04);
        const mesh = new THREE.Mesh(geom, is3D ? wall3DMaterial : wall2DMaterial);
        mesh.position.set(segMidX, segMidY, is3D ? wallHeight / 2 : 0.02);
        mesh.rotation.z = angle;
        mesh.castShadow = is3D;
        mesh.receiveShadow = is3D;

        // Arestas Técnicas Limpas
        const halfL = segLen / 2;
        const halfW = wallThickness / 2;
        const topZ = is3D ? wallHeight / 2 : 0.02;
        const botZ = is3D ? -wallHeight / 2 : -0.02;

        const edgePoints: THREE.Vector3[] = [];

        // Linha longitudinal: Lado +halfW (Eixo Y local positivo)
        let startXPlus = -halfL;
        let endXPlus = halfL;
        if (startAnalysis.isDominant && startAnalysis.connectedSide === 1 && startAnalysis.otherWall) {
          startXPlus = -halfL + startAnalysis.otherWall.thickness;
        }
        if (endAnalysis.isDominant && endAnalysis.connectedSide === 1 && endAnalysis.otherWall) {
          endXPlus = halfL - endAnalysis.otherWall.thickness;
        }
        if (endXPlus - startXPlus > 0.02) {
          edgePoints.push(new THREE.Vector3(startXPlus, halfW, topZ), new THREE.Vector3(endXPlus, halfW, topZ));
          if (is3D) {
            edgePoints.push(new THREE.Vector3(startXPlus, halfW, botZ), new THREE.Vector3(endXPlus, halfW, botZ));
          }
        }

        // Linha longitudinal: Lado -halfW (Eixo Y local negativo)
        let startXMinus = -halfL;
        let endXMinus = halfL;
        if (startAnalysis.isDominant && startAnalysis.connectedSide === -1 && startAnalysis.otherWall) {
          startXMinus = -halfL + startAnalysis.otherWall.thickness;
        }
        if (endAnalysis.isDominant && endAnalysis.connectedSide === -1 && endAnalysis.otherWall) {
          endXMinus = halfL - endAnalysis.otherWall.thickness;
        }
        if (endXMinus - startXMinus > 0.02) {
          edgePoints.push(new THREE.Vector3(startXMinus, -halfW, topZ), new THREE.Vector3(endXMinus, -halfW, topZ));
          if (is3D) {
            edgePoints.push(new THREE.Vector3(startXMinus, -halfW, botZ), new THREE.Vector3(endXMinus, -halfW, botZ));
          }
        }

        // Tampa da ponta inicial: desenha se for livre ou dominante (fecha o contorno externo da quina)
        if (startAnalysis.drawCap) {
          edgePoints.push(new THREE.Vector3(-halfL, -halfW, topZ), new THREE.Vector3(-halfL, halfW, topZ));
          if (is3D) {
            edgePoints.push(new THREE.Vector3(-halfL, -halfW, botZ), new THREE.Vector3(-halfL, halfW, botZ));
            edgePoints.push(new THREE.Vector3(-halfL, -halfW, botZ), new THREE.Vector3(-halfL, -halfW, topZ));
            edgePoints.push(new THREE.Vector3(-halfL, halfW, botZ), new THREE.Vector3(-halfL, halfW, topZ));
          }
        }

        // Tampa da ponta final: desenha se for livre ou dominante (fecha o contorno externo da quina)
        if (endAnalysis.drawCap) {
          edgePoints.push(new THREE.Vector3(halfL, -halfW, topZ), new THREE.Vector3(halfL, halfW, topZ));
          if (is3D) {
            edgePoints.push(new THREE.Vector3(halfL, -halfW, botZ), new THREE.Vector3(halfL, halfW, botZ));
            edgePoints.push(new THREE.Vector3(halfL, -halfW, botZ), new THREE.Vector3(halfL, -halfW, topZ));
            edgePoints.push(new THREE.Vector3(halfL, halfW, botZ), new THREE.Vector3(halfL, halfW, topZ));
          }
        }

        const edgeGeom = new THREE.BufferGeometry().setFromPoints(edgePoints);
        const edgeLine = new THREE.LineSegments(edgeGeom, is3D ? edgeMaterial3D : edgeMaterial2D);
        mesh.add(edgeLine);
        group.add(mesh);
      });

      // 2. Vãos com Dintel, Peitoril, Janelas e Portas
      openings.forEach((op) => {
        const opCenterX = wall.start.x + (dx / wallLen) * (op.centerRatio * wallLen);
        const opCenterY = wall.start.y + (dy / wallLen) * (op.centerRatio * wallLen);

        if (op.type === 'window') {
          const win = op.element as any;
          const sillH = win.sillHeight || 1.1;
          const winH = win.height || 1.0;
          const dintelH = Math.max(0, wallHeight - (sillH + winH));

          if (is3D) {
            // Peitoril da Janela
            if (sillH > 0.02) {
              const sillGeom = new THREE.BoxGeometry(op.width, wallThickness, sillH);
              addMeshWithEdges(sillGeom, sillMaterial, opCenterX, opCenterY, sillH / 2, angle);
            }

            // Dintel (Viga acima da janela)
            if (dintelH > 0.02) {
              const dintelGeom = new THREE.BoxGeometry(op.width, wallThickness, dintelH);
              addMeshWithEdges(
                dintelGeom,
                wall3DMaterial,
                opCenterX,
                opCenterY,
                sillH + winH + dintelH / 2,
                angle
              );
            }

            // Esquadria da Janela (Frame)
            const frameGeom = new THREE.BoxGeometry(op.width, wallThickness * 0.5, winH);
            addMeshWithEdges(frameGeom, frameMaterial, opCenterX, opCenterY, sillH + winH / 2, angle);

            // Vidro Translúcido
            const glassGeom = new THREE.BoxGeometry(
              Math.max(0.1, op.width - 0.08),
              0.02,
              Math.max(0.1, winH - 0.08)
            );
            addMeshWithEdges(glassGeom, glassMaterial, opCenterX, opCenterY, sillH + winH / 2, angle);
          } else {
            // Representação 2D da Janela (peitoril + linhas de vidro centrais)
            const sillGeom2D = new THREE.BoxGeometry(op.width, wallThickness, 0.02);
            addMeshWithEdges(sillGeom2D, wall2DMaterial, opCenterX, opCenterY, 0.01, angle);

            const glassLineGeom = new THREE.BoxGeometry(op.width, 0.02, 0.05);
            addMeshWithEdges(glassLineGeom, glassMaterial, opCenterX, opCenterY, 0.02, angle);
          }
        } else if (op.type === 'door') {
          const door = op.element as any;
          const doorH = door.height || 2.1;
          const dintelH = Math.max(0, wallHeight - doorH);

          if (is3D) {
            // Dintel acima da Porta
            if (dintelH > 0.02) {
              const dintelGeom = new THREE.BoxGeometry(op.width, wallThickness, dintelH);
              addMeshWithEdges(
                dintelGeom,
                wall3DMaterial,
                opCenterX,
                opCenterY,
                doorH + dintelH / 2,
                angle
              );
            }

            // Batentes Laterais da Porta
            const postW = 0.04;
            const postGeom = new THREE.BoxGeometry(postW, wallThickness, doorH);
            const leftDist = op.centerRatio * wallLen - op.width / 2 + postW / 2;
            const rightDist = op.centerRatio * wallLen + op.width / 2 - postW / 2;
            const lx = wall.start.x + (dx / wallLen) * leftDist;
            const ly = wall.start.y + (dy / wallLen) * leftDist;
            const rx = wall.start.x + (dx / wallLen) * rightDist;
            const ry = wall.start.y + (dy / wallLen) * rightDist;
            addMeshWithEdges(postGeom, frameMaterial, lx, ly, doorH / 2, angle);
            addMeshWithEdges(postGeom, frameMaterial, rx, ry, doorH / 2, angle);

            // Folha da Porta (aberta a 75 graus)
            const leafWidth = op.width - postW * 2;
            const leafGeom = new THREE.BoxGeometry(leafWidth, 0.035, doorH - 0.02);
            const swingAngle = door.flipFacing ? -Math.PI / 2.3 : Math.PI / 2.3;
            addMeshWithEdges(
              leafGeom,
              doorLeafMaterial,
              lx,
              ly,
              doorH / 2,
              angle + swingAngle
            );
          } else {
            // No 2D, a porta deixa o vão completamente livre na parede física
          }
        }
      });
    });
  }, [
    elements.walls,
    elements.doors,
    elements.windows,
    elements.floors,
    elements.roofs,
    elements.stairs,
    activeView,
  ]);

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

  // Manipulação de Mouse no modo 3D (Shift+Scroll para Órbita 3D, Scroll puro para Pan 2D)
  const orbitModeRef = useRef<'orbit' | 'pan'>('orbit');

  const handlePointerDown3D = (e: React.PointerEvent) => {
    if (activeView !== '3d') return;

    // Scroll (botão 1), botão direito (2) ou botão esquerdo (0)
    if (e.button === 1 || e.button === 2 || e.button === 0) {
      // Se Shift estiver pressionado (ou botão esquerdo): Órbita 3D
      // Se apenas o Scroll (botão 1) ou botão direito: Pan 2D
      const shouldOrbit = e.shiftKey || (e.button === 0 && !e.altKey);
      orbitModeRef.current = shouldOrbit ? 'orbit' : 'pan';

      orbitRef.current.isDragging = true;
      orbitRef.current.lastMouse = { x: e.clientX, y: e.clientY };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
    }
  };

  const handlePointerMove3D = (e: React.PointerEvent) => {
    if (activeView !== '3d' || !orbitRef.current.isDragging) return;

    const dx = e.clientX - orbitRef.current.lastMouse.x;
    const dy = e.clientY - orbitRef.current.lastMouse.y;
    orbitRef.current.lastMouse = { x: e.clientX, y: e.clientY };

    if (orbitModeRef.current === 'orbit') {
      // Rotação orbital 3D
      orbitRef.current.theta -= dx * 0.008;
      orbitRef.current.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, orbitRef.current.phi - dy * 0.008));
    } else {
      // Pan 2D no espaço 3D (deslocamento pelo plano de visão da câmera)
      if (perspCameraRef.current) {
        const cam = perspCameraRef.current;
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const right = new THREE.Vector3().crossVectors(dir, cam.up).normalize();
        const up = new THREE.Vector3().crossVectors(right, dir).normalize();

        const panSpeed = orbitRef.current.radius * 0.0016;
        orbitRef.current.target.addScaledVector(right, -dx * panSpeed);
        orbitRef.current.target.addScaledVector(up, dy * panSpeed);
      }
    }
  };

  const handlePointerUp3D = (e: React.PointerEvent) => {
    if (activeView === '3d') {
      orbitRef.current.isDragging = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
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
      onAuxClick={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown3D}
      onPointerMove={handlePointerMove3D}
      onPointerUp={handlePointerUp3D}
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

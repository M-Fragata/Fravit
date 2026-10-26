import React, { useRef, useEffect, useState } from 'react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import { computeSnap, distance } from '../../cad-core/snaps/snapEngine';
import type {
  Point2D,
  SnapResult,
  WallElement,
  DoorElement,
  WindowElement,
  FloorElement,
  RoofElement,
  StairElement,
  RoomElement,
  RoomSeparatorElement,
  DimensionElement,
  SectionElement,
} from '../../cad-core/types';
import {
  findNearestHostWall,
  computePolygonArea,
  detectClosedRoomPolygon,
  computeStairParameters,
} from '../../cad-core/geometry/wallGeometry';
import { drawRevitDimension } from '../../cad-core/geometry/revitDimension';

interface CanvasOverlayProps {
  panRef: React.MutableRefObject<Point2D>;
  zoomRef: React.MutableRefObject<number>;
  triggerRender: () => void;
  screenToWorld: (x: number, y: number) => Point2D;
  worldToScreen: (x: number, y: number) => Point2D;
  onCursorMove?: (worldPos: Point2D) => void;
}

export const CanvasOverlay: React.FC<CanvasOverlayProps> = ({
  panRef,
  zoomRef,
  triggerRender,
  screenToWorld,
  worldToScreen,
  onCursorMove,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useBIM();
  const { activeTool, activeLevelId, elements, snapConfig, defaults } = state;

  // Estados de desenho interativo
  const [drawingStart, setDrawingStart] = useState<Point2D | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point2D[]>([]);
  const [currentSnapped, setCurrentSnapped] = useState<SnapResult | null>(null);
  const [numericInput, setNumericInput] = useState<string>('');
  const [doorFlipFacing, setDoorFlipFacing] = useState<boolean>(false);
  const [doorFlipHand, setDoorFlipHand] = useState<boolean>(false);
  const [dimP1, setDimP1] = useState<Point2D | null>(null);
  const [dimP2, setDimP2] = useState<Point2D | null>(null);
  const [secP1, setSecP1] = useState<Point2D | null>(null);
  const [secP2, setSecP2] = useState<Point2D | null>(null);

  const mousePosScreenRef = useRef<{ x: number; y: number }>({ x: -100, y: -100 });
  const rawWorldMouseRef = useRef<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const startPanMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpacePressedRef = useRef<boolean>(false);

  // 1. Manter dimensões do Canvas sincronizadas com o container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
        }
      }
    });

    resizeObserver.observe(canvas.parentElement);
    return () => resizeObserver.disconnect();
  }, []);

  // 2. Renderização Técnica 2D no Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mouse = mousePosScreenRef.current;
      const snapped = currentSnapped?.point;
      const zoom = zoomRef.current;
      const rawWorld = rawWorldMouseRef.current;

      // ==========================================
      // I. ELEMENTOS BIM EXISTENTES (2D NBR)
      // ==========================================

      // A. Pisos Existentes (Hachura / Preenchimento Sutil)
      elements.floors.forEach((fl) => {
        if (fl.polygon.length < 3) return;
        ctx.beginPath();
        const start = worldToScreen(fl.polygon[0].x, fl.polygon[0].y);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < fl.polygon.length; i++) {
          const pt = worldToScreen(fl.polygon[i].x, fl.polygon[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // B. Telhados Existentes (Coberturas)
      elements.roofs.forEach((rf) => {
        if (rf.polygon.length < 3) return;
        ctx.beginPath();
        const start = worldToScreen(rf.polygon[0].x, rf.polygon[0].y);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < rf.polygon.length; i++) {
          const pt = worldToScreen(rf.polygon[i].x, rf.polygon[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // C. Separadores de Ambiente (Linha Traço-Ponto Magenta)
      elements.roomSeparators.forEach((sep) => {
        const s = worldToScreen(sep.start.x, sep.start.y);
        const e = worldToScreen(sep.end.x, sep.end.y);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.strokeStyle = '#ec4899'; // Magenta arquitetônico
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 4, 2, 4]); // Traço-ponto
        ctx.stroke();
        ctx.restore();
      });

      // D. Portas 2D Existentes (Vão, Folha 90° e Arco de Giro NBR)
      elements.doors.forEach((door) => {
        const host = elements.walls.find((w) => w.id === door.wallId);
        if (!host) return;

        const dx = host.end.x - host.start.x;
        const dy = host.end.y - host.start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) return;

        const ux = dx / len;
        const uy = dy / len;
        const perpX = -uy;
        const perpY = ux;

        const doorCx = host.start.x + ux * (door.offsetRatio * len);
        const doorCy = host.start.y + uy * (door.offsetRatio * len);
        const halfW = door.width / 2;

        const isLeftHinge = !door.flipHand;
        const hingeX = isLeftHinge ? doorCx - ux * halfW : doorCx + ux * halfW;
        const hingeY = isLeftHinge ? doorCy - uy * halfW : doorCy + uy * halfW;
        const hingeScreen = worldToScreen(hingeX, hingeY);

        const facingSign = door.flipFacing ? -1 : 1;
        const leafEndX = hingeX + perpX * (door.width * facingSign);
        const leafEndY = hingeY + perpY * (door.width * facingSign);
        const leafScreen = worldToScreen(leafEndX, leafEndY);

        // Folha da Porta
        ctx.beginPath();
        ctx.moveTo(hingeScreen.x, hingeScreen.y);
        ctx.lineTo(leafScreen.x, leafScreen.y);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Arco de Giro NBR (tracejado fino)
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const baseAngle = Math.atan2(uy, ux);
        const startAngle = isLeftHinge ? baseAngle : baseAngle + Math.PI;
        const endAngle = baseAngle + (Math.PI / 2) * facingSign;
        const anticlockwise = isLeftHinge ? facingSign > 0 : facingSign < 0;
        ctx.arc(
          hingeScreen.x,
          hingeScreen.y,
          door.width * zoom,
          -startAngle,
          -endAngle,
          anticlockwise
        );
        ctx.stroke();
        ctx.restore();
      });

      // E. Janelas 2D Existentes (Peitoril e Caixilho Central)
      elements.windows.forEach((win) => {
        const host = elements.walls.find((w) => w.id === win.wallId);
        if (!host) return;

        const dx = host.end.x - host.start.x;
        const dy = host.end.y - host.start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) return;

        const ux = dx / len;
        const uy = dy / len;
        const winCx = host.start.x + ux * (win.offsetRatio * len);
        const winCy = host.start.y + uy * (win.offsetRatio * len);
        const halfW = win.width / 2;

        const p1 = worldToScreen(winCx - ux * halfW, winCy - uy * halfW);
        const p2 = worldToScreen(winCx + ux * halfW, winCy + uy * halfW);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      });

      // F. Escadas 2D Existentes (Degraus + Breakline + Seta SOBE)
      elements.stairs.forEach((st) => {
        const dx = st.end.x - st.start.x;
        const dy = st.end.y - st.start.y;
        const totalLen = Math.sqrt(dx * dx + dy * dy);
        if (totalLen < 0.2) return;

        const ux = dx / totalLen;
        const uy = dy / totalLen;
        const perpX = -uy * ((st.width || 0.9) / 2);
        const perpY = ux * ((st.width || 0.9) / 2);

        const steps = Math.max(2, Math.round(2.8 / (st.riserHeight || 0.175)));
        const stepLen = totalLen / steps;

        // Degraus
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        for (let s = 0; s <= steps; s++) {
          const stepDist = s * stepLen;
          const cx = st.start.x + ux * stepDist;
          const cy = st.start.y + uy * stepDist;
          const left = worldToScreen(cx + perpX, cy + perpY);
          const right = worldToScreen(cx - perpX, cy - perpY);

          ctx.beginPath();
          ctx.moveTo(left.x, left.y);
          ctx.lineTo(right.x, right.y);
          ctx.stroke();
        }

        // Linha de Subida com Seta
        const startScreen = worldToScreen(st.start.x, st.start.y);
        const endScreen = worldToScreen(st.end.x, st.end.y);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(startScreen.x, startScreen.y, 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(startScreen.x, startScreen.y);
        ctx.lineTo(endScreen.x, endScreen.y);
        ctx.stroke();

        // Texto SOBE
        const midScreen = worldToScreen((st.start.x + st.end.x) / 2, (st.start.y + st.end.y) / 2);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SOBE', midScreen.x + 16, midScreen.y - 6);
      });

      // G. Ambientes 2D Existentes (Tags com Nome e m²)
      elements.rooms.forEach((room) => {
        if (room.polygon.length < 3) return;

        // Fundo do Ambiente
        ctx.beginPath();
        const start = worldToScreen(room.polygon[0].x, room.polygon[0].y);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < room.polygon.length; i++) {
          const pt = worldToScreen(room.polygon[i].x, room.polygon[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.05)';
        ctx.fill();

        // Centroide para a Tag
        let avgX = 0;
        let avgY = 0;
        for (const pt of room.polygon) {
          avgX += pt.x;
          avgY += pt.y;
        }
        avgX /= room.polygon.length;
        avgY /= room.polygon.length;

        const tagScreen = worldToScreen(avgX, avgY);

        // Tag Revit / NBR do Ambiente
        const title = room.name.toUpperCase();
        const areaStr = `${room.areaM2.toFixed(2)} m²`;

        ctx.font = '700 12px "Inter", sans-serif';
        const titleW = ctx.measureText(title).width;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        const areaW = ctx.measureText(areaStr).width;
        const boxW = Math.max(titleW, areaW) + 24;
        const boxH = 40;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#22c55e'; // Verde de ambiente
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(tagScreen.x - boxW / 2, tagScreen.y - boxH / 2, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = '700 11px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, tagScreen.x, tagScreen.y - 4);

        ctx.fillStyle = '#22c55e';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillText(areaStr, tagScreen.x, tagScreen.y + 12);
      });

      // H. Cotas 2D Existentes no Padrão Revit / NBR
      elements.dimensions
        .filter((dim) => !dim.view || dim.view === 'plan')
        .forEach((dim) => {
          const dx = dim.end.x - dim.start.x;
          const dy = dim.end.y - dim.start.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.05) return;

          const ux = dx / len;
          const uy = dy / len;
          const nx = -uy;
          const ny = ux;

          const offset = dim.offset || 0.4;

          // Ponto deslocado da cota
          const c1World = { x: dim.start.x + nx * offset, y: dim.start.y + ny * offset };
          const c2World = { x: dim.end.x + nx * offset, y: dim.end.y + ny * offset };

          const s1 = worldToScreen(dim.start.x, dim.start.y);
          const s2 = worldToScreen(dim.end.x, dim.end.y);
          const sc1 = worldToScreen(c1World.x, c1World.y);
          const sc2 = worldToScreen(c2World.x, c2World.y);

          drawRevitDimension(ctx, s1, s2, sc1, sc2, len);
        });

      // I. Linhas de Corte Existentes (Sections NBR)
      elements.sections.forEach((sec) => {
        const dx = sec.end.x - sec.start.x;
        const dy = sec.end.y - sec.start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) return;

        const ux = dx / len;
        const uy = dy / len;
        const nx = -uy;
        const ny = ux;

        const s1 = worldToScreen(sec.start.x, sec.start.y);
        const s2 = worldToScreen(sec.end.x, sec.end.y);

        ctx.save();

        // 1. Linha de Corte Traço-Ponto
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([14, 4, 3, 4]); // Traço-ponto NBR
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. Caixa de Profundidade do Corte (Far Clip Depth)
        const dir = sec.direction ?? 1;
        const lookNx = nx * dir;
        const lookNy = ny * dir;
        const farDepth = sec.farClipDepth || 2.0;

        const f1 = worldToScreen(sec.start.x + lookNx * farDepth, sec.start.y + lookNy * farDepth);
        const f2 = worldToScreen(sec.end.x + lookNx * farDepth, sec.end.y + lookNy * farDepth);
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(f1.x, f1.y);
        ctx.lineTo(f2.x, f2.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. Símbolos de Ponta Normatizados NBR (Círculo + Letra + Seta de Visão)
        const letterMatch = sec.name.match(/[A-Za-z]/);
        const letter = letterMatch ? letterMatch[0].toUpperCase() : 'A';
        const radius = 13;

        // Sentido da seta na tela (Y da tela é invertido em relação a mundo)
        const arrowDirX = lookNx;
        const arrowDirY = -lookNy;
        const perpX = -arrowDirY;
        const perpY = arrowDirX;

        [s1, s2].forEach((pt) => {
          // Círculo
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Seta de Sentido de Visão
          const tipX = pt.x + arrowDirX * (radius + 9);
          const tipY = pt.y + arrowDirY * (radius + 9);
          const baseLeftX = pt.x + arrowDirX * radius - perpX * 6;
          const baseLeftY = pt.y + arrowDirY * radius - perpY * 6;
          const baseRightX = pt.x + arrowDirX * radius + perpX * 6;
          const baseRightY = pt.y + arrowDirY * radius + perpY * 6;

          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(baseLeftX, baseLeftY);
          ctx.lineTo(baseRightX, baseRightY);
          ctx.closePath();
          ctx.fillStyle = '#ec4899';
          ctx.fill();

          // Letra do Corte
          ctx.fillStyle = '#ffffff';
          ctx.font = '700 12px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(letter, pt.x, pt.y);
        });

        ctx.restore();
      });

      // ==========================================
      // II. FEEDBACK INTERATIVO DA FERRAMENTA ATIVA
      // ==========================================

      // A. Ferramenta PAREDE (Linha Elástica e Cotas Dinâmicas)
      if (drawingStart && activeTool === 'wall' && snapped) {
        const screenStart = worldToScreen(drawingStart.x, drawingStart.y);
        const screenSnap = worldToScreen(snapped.x, snapped.y);

        ctx.beginPath();
        ctx.moveTo(screenStart.x, screenStart.y);
        ctx.lineTo(screenSnap.x, screenSnap.y);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = Math.max(3, defaults.wall.thickness * zoom);
        ctx.lineCap = 'round';
        ctx.stroke();

        const distMeters = distance(drawingStart, snapped);
        const midX = (screenStart.x + screenSnap.x) / 2;
        const midY = (screenStart.y + screenSnap.y) / 2;

        const hasPolarAngle = currentSnapped?.polarAngle !== undefined;
        const label = hasPolarAngle
          ? `${distMeters.toFixed(2)} m  ∠ ${currentSnapped.polarAngle}°`
          : `${distMeters.toFixed(2)} m`;

        ctx.fillStyle = 'rgba(12, 16, 23, 0.95)';
        ctx.strokeStyle = hasPolarAngle ? '#10b981' : '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.font = '700 13px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(label).width;

        ctx.beginPath();
        ctx.roundRect(midX - textWidth / 2 - 10, midY - 26, textWidth + 20, 24, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = hasPolarAngle ? '#10b981' : '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, midX, midY - 14);
      }

      // B. Ferramenta PORTA (Ghost Preview na Parede mais próxima)
      if (activeTool === 'door') {
        const host = findNearestHostWall(rawWorld, elements.walls, 1.2);
        if (host) {
          const dx = host.wall.end.x - host.wall.start.x;
          const dy = host.wall.end.y - host.wall.start.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / len;
          const uy = dy / len;
          const perpX = -uy;
          const perpY = ux;

          const cx = host.projectedPoint.x;
          const cy = host.projectedPoint.y;
          const halfW = defaults.door.width / 2;

          const isLeftHinge = !doorFlipHand;
          const hingeX = isLeftHinge ? cx - ux * halfW : cx + ux * halfW;
          const hingeY = isLeftHinge ? cy - uy * halfW : cy + uy * halfW;
          const hingeScreen = worldToScreen(hingeX, hingeY);

          const facingSign = doorFlipFacing ? -1 : 1;
          const leafEndX = hingeX + perpX * (defaults.door.width * facingSign);
          const leafEndY = hingeY + perpY * (defaults.door.width * facingSign);
          const leafScreen = worldToScreen(leafEndX, leafEndY);

          // Folha da Porta Preview
          ctx.beginPath();
          ctx.moveTo(hingeScreen.x, hingeScreen.y);
          ctx.lineTo(leafScreen.x, leafScreen.y);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Arco de Giro Preview
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const baseAngle = Math.atan2(uy, ux);
          const startAngle = isLeftHinge ? baseAngle : baseAngle + Math.PI;
          const endAngle = baseAngle + (Math.PI / 2) * facingSign;
          const anticlockwise = isLeftHinge ? facingSign > 0 : facingSign < 0;
          ctx.arc(
            hingeScreen.x,
            hingeScreen.y,
            defaults.door.width * zoom,
            -startAngle,
            -endAngle,
            anticlockwise
          );
          ctx.stroke();
          ctx.restore();

          // Cotas Temporárias do Revit: distâncias laterais até as extremidades da parede
          const distToStart = Math.max(0, host.ratio * len - halfW);
          const distToEnd = Math.max(0, len - (host.ratio * len + halfW));

          const drawTempDimension = (
            pFrom: Point2D,
            pTo: Point2D,
            distVal: number,
            offsetPx: number
          ) => {
            if (distVal < 0.05) return;
            const sf = worldToScreen(pFrom.x, pFrom.y);
            const st = worldToScreen(pTo.x, pTo.y);

            const vx = -(st.y - sf.y);
            const vy = st.x - sf.x;
            const vlen = Math.hypot(vx, vy);
            if (vlen < 0.01) return;
            const nx = (vx / vlen) * offsetPx;
            const ny = (vy / vlen) * offsetPx;

            const dStart = { x: sf.x + nx, y: sf.y + ny };
            const dEnd = { x: st.x + nx, y: st.y + ny };

            drawRevitDimension(ctx, sf, st, dStart, dEnd, distVal, {
              color: '#38bdf8',
              textColor: '#38bdf8',
            });
          };

          // Desenha as duas cotas temporárias da porta até as extremidades da parede
          const doorStartPoint = { x: cx - ux * halfW, y: cy - uy * halfW };
          const doorEndPoint = { x: cx + ux * halfW, y: cy + uy * halfW };
          drawTempDimension(host.wall.start, doorStartPoint, distToStart, 26);
          drawTempDimension(doorEndPoint, host.wall.end, distToEnd, 26);

          // Dica Flutuante
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1;
          ctx.font = '600 11px "Inter", sans-serif';
          const tipText = 'Clique para fixar porta • [Espaço] 4 opções (lado / abertura)';
          const tipW = ctx.measureText(tipText).width;
          ctx.beginPath();
          ctx.roundRect(hingeScreen.x - tipW / 2, hingeScreen.y - 36, tipW + 16, 22, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#f59e0b';
          ctx.textAlign = 'center';
          ctx.fillText(tipText, hingeScreen.x + 8, hingeScreen.y - 22);
        }
      }

      // C. Ferramenta JANELA (Ghost Preview na Parede)
      if (activeTool === 'window') {
        const host = findNearestHostWall(rawWorld, elements.walls, 1.2);
        if (host) {
          const dx = host.wall.end.x - host.wall.start.x;
          const dy = host.wall.end.y - host.wall.start.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / len;
          const uy = dy / len;

          const cx = host.projectedPoint.x;
          const cy = host.projectedPoint.y;
          const halfW = defaults.window.width / 2;

          const p1 = worldToScreen(cx - ux * halfW, cy - uy * halfW);
          const p2 = worldToScreen(cx + ux * halfW, cy + uy * halfW);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 4;
          ctx.stroke();

          // Cotas Temporárias do Revit para Janela
          const distToStart = Math.max(0, host.ratio * len - halfW);
          const distToEnd = Math.max(0, len - (host.ratio * len + halfW));

          const drawTempDimension = (
            pFrom: Point2D,
            pTo: Point2D,
            distVal: number,
            offsetPx: number
          ) => {
            if (distVal < 0.05) return;
            const sf = worldToScreen(pFrom.x, pFrom.y);
            const st = worldToScreen(pTo.x, pTo.y);

            const vx = -(st.y - sf.y);
            const vy = st.x - sf.x;
            const vlen = Math.sqrt(vx * vx + vy * vy);
            if (vlen < 0.01) return;
            const nx = (vx / vlen) * offsetPx;
            const ny = (vy / vlen) * offsetPx;

            const dStart = { x: sf.x + nx, y: sf.y + ny };
            const dEnd = { x: st.x + nx, y: st.y + ny };

            ctx.save();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.2;

            // Linhas de chamada
            ctx.beginPath();
            ctx.moveTo(sf.x, sf.y);
            ctx.lineTo(dStart.x, dStart.y);
            ctx.moveTo(st.x, st.y);
            ctx.lineTo(dEnd.x, dEnd.y);
            ctx.stroke();

            // Linha da cota
            ctx.beginPath();
            ctx.moveTo(dStart.x, dStart.y);
            ctx.lineTo(dEnd.x, dEnd.y);
            ctx.stroke();

            // Ticks a 45°
            const tk = 4;
            ctx.beginPath();
            ctx.moveTo(dStart.x - tk, dStart.y + tk);
            ctx.lineTo(dStart.x + tk, dStart.y - tk);
            ctx.moveTo(dEnd.x - tk, dEnd.y + tk);
            ctx.lineTo(dEnd.x + tk, dEnd.y - tk);
            ctx.stroke();

            const midDimX = (dStart.x + dEnd.x) / 2;
            const midDimY = (dStart.y + dEnd.y) / 2;
            const label = `${distVal.toFixed(2)} m`;
            ctx.font = '700 11px "JetBrains Mono", monospace';
            const lw = ctx.measureText(label).width;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(midDimX - lw / 2 - 6, midDimY - 10, lw + 12, 20, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, midDimX, midDimY);
            ctx.restore();
          };

          const winStartPoint = { x: cx - ux * halfW, y: cy - uy * halfW };
          const winEndPoint = { x: cx + ux * halfW, y: cy + uy * halfW };
          drawTempDimension(host.wall.start, winStartPoint, distToStart, 26);
          drawTempDimension(winEndPoint, host.wall.end, distToEnd, 26);

          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.font = '600 11px "Inter", sans-serif';
          const tipText = `Janela ${defaults.window.width}m • Clique na parede para inserir`;
          const tipW = ctx.measureText(tipText).width;
          ctx.beginPath();
          ctx.roundRect((p1.x + p2.x) / 2 - tipW / 2, (p1.y + p2.y) / 2 - 32, tipW + 16, 22, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(tipText, (p1.x + p2.x) / 2 + 8, (p1.y + p2.y) / 2 - 18);
        }
      }

      // D. Ferramenta PISO / TELHADO (Polígono em Construção)
      if ((activeTool === 'floor' || activeTool === 'roof') && polygonPoints.length > 0 && snapped) {
        ctx.save();
        ctx.beginPath();
        const first = worldToScreen(polygonPoints[0].x, polygonPoints[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < polygonPoints.length; i++) {
          const pt = worldToScreen(polygonPoints[i].x, polygonPoints[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        const snapScreen = worldToScreen(snapped.x, snapped.y);
        ctx.lineTo(snapScreen.x, snapScreen.y);

        ctx.fillStyle = activeTool === 'floor' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        ctx.fill();
        ctx.strokeStyle = activeTool === 'floor' ? '#38bdf8' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Marcador no primeiro ponto para fechar o polígono
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(first.x, first.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // E. Ferramenta ESCADA (Rubberband com Degraus e Blondel)
      if (activeTool === 'stair' && drawingStart && snapped) {
        const s = worldToScreen(drawingStart.x, drawingStart.y);
        const e = worldToScreen(snapped.x, snapped.y);
        const dist = distance(drawingStart, snapped);
        const stairData = computeStairParameters(2.8, 0.28);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        const badge = `${dist.toFixed(2)}m • ${stairData.stepsCount} degraus (Espelho ${(stairData.riserHeight * 100).toFixed(1)}cm • Blondel: ${(stairData.blondelValue * 100).toFixed(0)}cm)`;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        const bw = ctx.measureText(badge).width;
        ctx.beginPath();
        ctx.roundRect((s.x + e.x) / 2 - bw / 2, (s.y + e.y) / 2 - 28, bw + 16, 22, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText(badge, (s.x + e.x) / 2 + 8, (s.y + e.y) / 2 - 14);
      }

      // F. Ferramenta AMBIENTE (Detecção sob o Cursor)
      if (activeTool === 'room') {
        const detectedPoly = detectClosedRoomPolygon(rawWorld, elements.walls);
        if (detectedPoly && detectedPoly.length >= 3) {
          ctx.beginPath();
          const first = worldToScreen(detectedPoly[0].x, detectedPoly[0].y);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < detectedPoly.length; i++) {
            const pt = worldToScreen(detectedPoly[i].x, detectedPoly[i].y);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
          ctx.fill();
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.stroke();

          const area = computePolygonArea(detectedPoly);
          const mouseScreen = worldToScreen(rawWorld.x, rawWorld.y);
          const label = `Clique para criar Ambiente • ${area.toFixed(2)} m²`;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 1;
          ctx.font = '700 11px "Inter", sans-serif';
          const lw = ctx.measureText(label).width;
          ctx.beginPath();
          ctx.roundRect(mouseScreen.x - lw / 2, mouseScreen.y - 30, lw + 16, 22, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#22c55e';
          ctx.textAlign = 'center';
          ctx.fillText(label, mouseScreen.x + 8, mouseScreen.y - 16);
        }
      }

      // G1. Feedback da Ferramenta COTA ALINHADA (Dimension)
      if (activeTool === 'dimension' && snapped) {
        if (dimP1 && !dimP2) {
          const s1 = worldToScreen(dimP1.x, dimP1.y);
          const s2 = worldToScreen(snapped.x, snapped.y);
          const dist = distance(dimP1, snapped);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();

          const label = `${dist.toFixed(2)} m • Clique para fixar 2º ponto`;
          ctx.font = '600 11px "JetBrains Mono", monospace';
          const lw = ctx.measureText(label).width;
          const mx = (s1.x + s2.x) / 2;
          const my = (s1.y + s2.y) / 2;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.beginPath();
          ctx.roundRect(mx - lw / 2 - 6, my - 22, lw + 12, 20, 4);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(label, mx, my - 8);
          ctx.restore();
        } else if (dimP1 && dimP2) {
          const dx = dimP2.x - dimP1.x;
          const dy = dimP2.y - dimP1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0.01) {
            const nx = -dy / len;
            const ny = dx / len;
            const offset = (snapped.x - dimP1.x) * nx + (snapped.y - dimP1.y) * ny;

            const c1 = { x: dimP1.x + nx * offset, y: dimP1.y + ny * offset };
            const c2 = { x: dimP2.x + nx * offset, y: dimP2.y + ny * offset };

            const s1 = worldToScreen(dimP1.x, dimP1.y);
            const s2 = worldToScreen(dimP2.x, dimP2.y);
            const sc1 = worldToScreen(c1.x, c1.y);
            const sc2 = worldToScreen(c2.x, c2.y);

            drawRevitDimension(ctx, s1, s2, sc1, sc2, len, {
              extraNote: 'Clique para fixar posição da cota',
            });
          }
        }
      }

      // G2. Feedback da Ferramenta CORTE (Section em 3 Cliques: P1 -> P2 -> Sentido/Profundidade)
      if (activeTool === 'section' && snapped) {
        if (secP1 && !secP2) {
          // Fase 1: Desenhando o traço de corte
          const s1 = worldToScreen(secP1.x, secP1.y);
          const s2 = worldToScreen(snapped.x, snapped.y);
          const dist = distance(secP1, snapped);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2;
          ctx.setLineDash([14, 4, 3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          const letter = String.fromCharCode(65 + elements.sections.length);
          const label = `Corte ${letter}-${letter} (${dist.toFixed(2)} m) • 2º Clique: Final da linha de corte`;
          const mx = (s1.x + s2.x) / 2;
          const my = (s1.y + s2.y) / 2;

          ctx.font = '600 11px "Inter", sans-serif';
          const lw = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.beginPath();
          ctx.roundRect(mx - lw / 2 - 6, my - 22, lw + 12, 20, 4);
          ctx.fill();
          ctx.fillStyle = '#ec4899';
          ctx.textAlign = 'center';
          ctx.fillText(label, mx, my - 8);
          ctx.restore();
        } else if (secP1 && secP2) {
          // Fase 2: Definindo direção de visão (para cima/baixo/esq/dir) e profundidade
          const s1 = worldToScreen(secP1.x, secP1.y);
          const s2 = worldToScreen(secP2.x, secP2.y);

          const sDx = secP2.x - secP1.x;
          const sDy = secP2.y - secP1.y;
          const sLen = Math.sqrt(sDx * sDx + sDy * sDy) || 1;
          const nx = -sDy / sLen;
          const ny = sDx / sLen;

          // Vetor secP1 -> cursor snapped
          const vx = snapped.x - secP1.x;
          const vy = snapped.y - secP1.y;
          const side = vx * nx + vy * ny;
          const dir = side >= 0 ? 1 : -1;
          const farDepth = Math.max(0.6, Math.abs(side));

          const lookNx = nx * dir;
          const lookNy = ny * dir;

          ctx.save();

          // 1. Linha do corte
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2;
          ctx.setLineDash([14, 4, 3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // 2. Caixa de profundidade dinâmica estendida no lado do mouse
          const f1 = worldToScreen(secP1.x + lookNx * farDepth, secP1.y + lookNy * farDepth);
          const f2 = worldToScreen(secP2.x + lookNx * farDepth, secP2.y + lookNy * farDepth);
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(f1.x, f1.y);
          ctx.lineTo(f2.x, f2.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);

          // 3. Setas e Círculos com orientação dinâmica para o lado do mouse
          const letter = String.fromCharCode(65 + elements.sections.length);
          const radius = 13;
          const arrowDirX = lookNx;
          const arrowDirY = -lookNy; // Y de tela é invertido
          const perpX = -arrowDirY;
          const perpY = arrowDirX;

          [s1, s2].forEach((pt) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 2;
            ctx.stroke();

            const tipX = pt.x + arrowDirX * (radius + 9);
            const tipY = pt.y + arrowDirY * (radius + 9);
            const baseLeftX = pt.x + arrowDirX * radius - perpX * 6;
            const baseLeftY = pt.y + arrowDirY * radius - perpY * 6;
            const baseRightX = pt.x + arrowDirX * radius + perpX * 6;
            const baseRightY = pt.y + arrowDirY * radius + perpY * 6;

            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(baseLeftX, baseLeftY);
            ctx.lineTo(baseRightX, baseRightY);
            ctx.closePath();
            ctx.fillStyle = '#ec4899';
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = '700 12px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(letter, pt.x, pt.y);
          });

          // Rótulo de orientação ao usuário
          const mx = (s1.x + s2.x) / 2;
          const my = (s1.y + s2.y) / 2;
          const dirDesc = dir > 0 ? 'Superior / Esquerda' : 'Inferior / Direita';
          const label = `Corte ${letter}-${letter} (${farDepth.toFixed(2)} m) • 3º Clique: Fixar sentido (${dirDesc})`;

          ctx.font = '600 11px "Inter", sans-serif';
          const lw = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.beginPath();
          ctx.roundRect(mx - lw / 2 - 8, my - 24, lw + 16, 20, 4);
          ctx.fill();
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#ec4899';
          ctx.textAlign = 'center';
          ctx.fillText(label, mx, my - 10);

          ctx.restore();
        }
      }

      // G. Guias Polares (Raios pontilhados estendidos nos ângulos de 45°)
      if (currentSnapped?.guideLines) {
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 1.8;

        for (const guide of currentSnapped.guideLines) {
          const s = worldToScreen(guide.start.x, guide.start.y);
          const e = worldToScreen(guide.end.x, guide.end.y);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // H. Marcadores de Snap Magnético e Identificação de Faces/Extremidades
      if (currentSnapped) {
        const screenSnap = worldToScreen(currentSnapped.point.x, currentSnapped.point.y);

        if (currentSnapped.type === 'wall_ext') {
          // Face ou Extremidade Externa: Losango / Indicador Ciano
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(screenSnap.x, screenSnap.y - 7);
          ctx.lineTo(screenSnap.x + 7, screenSnap.y);
          ctx.lineTo(screenSnap.x, screenSnap.y + 7);
          ctx.lineTo(screenSnap.x - 7, screenSnap.y);
          ctx.closePath();
          ctx.stroke();
        } else if (currentSnapped.type === 'wall_int') {
          // Face ou Extremidade Interna: Losango / Indicador Esmeralda
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(screenSnap.x, screenSnap.y - 7);
          ctx.lineTo(screenSnap.x + 7, screenSnap.y);
          ctx.lineTo(screenSnap.x, screenSnap.y + 7);
          ctx.lineTo(screenSnap.x - 7, screenSnap.y);
          ctx.closePath();
          ctx.stroke();
        } else if (currentSnapped.type === 'wall_center') {
          // Eixo Central: Círculo com Mira Central Roxa/Azul
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(screenSnap.x, screenSnap.y, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(screenSnap.x - 9, screenSnap.y);
          ctx.lineTo(screenSnap.x + 9, screenSnap.y);
          ctx.moveTo(screenSnap.x, screenSnap.y - 9);
          ctx.lineTo(screenSnap.x, screenSnap.y + 9);
          ctx.stroke();
        } else if (currentSnapped.type === 'endpoint') {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(screenSnap.x - 7, screenSnap.y - 7, 14, 14);
        } else if (currentSnapped.type === 'midpoint') {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(screenSnap.x, screenSnap.y - 8);
          ctx.lineTo(screenSnap.x + 8, screenSnap.y + 7);
          ctx.lineTo(screenSnap.x - 8, screenSnap.y + 7);
          ctx.closePath();
          ctx.stroke();
        } else if (currentSnapped.type === 'grid') {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(screenSnap.x, screenSnap.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Etiqueta Tooltip Normativa do Snap (ex: "Face Externa", "Extremidade Interna", "Eixo Central")
        if (currentSnapped.label) {
          ctx.save();
          ctx.font = '600 10px "JetBrains Mono", monospace';
          const labelText = currentSnapped.label;
          const textWidth = ctx.measureText(labelText).width;
          const badgeX = screenSnap.x + 12;
          const badgeY = screenSnap.y - 20;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.strokeStyle =
            currentSnapped.type === 'wall_ext'
              ? '#38bdf8'
              : currentSnapped.type === 'wall_int'
              ? '#34d399'
              : '#a855f7';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, textWidth + 12, 18, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = ctx.strokeStyle;
          ctx.textAlign = 'left';
          ctx.fillText(labelText, badgeX + 6, badgeY + 12);
          ctx.restore();
        }
      }

      // I. Mira Técnica CAD (Crosshair)
      if (mouse.x > 0 && mouse.y > 0 && !isPanningRef.current) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(mouse.x - 16, mouse.y);
        ctx.lineTo(mouse.x + 16, mouse.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y - 16);
        ctx.lineTo(mouse.x, mouse.y + 16);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    drawingStart,
    polygonPoints,
    currentSnapped,
    doorFlipFacing,
    doorFlipHand,
    activeTool,
    defaults,
    elements,
    worldToScreen,
    zoomRef,
  ]);

  const shortcutBufferRef = useRef<string>('');
  const shortcutTimerRef = useRef<any>(null);

  // 3. Captura Global de Teclado (Atalhos Revit de 2 letras, Escape, F8, Espaço, Entrada Numérica direta)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // Tecla Escape: cancela qualquer operação ativa e VAI DIRETO para Modificar / Selecionar (select)
      if (e.key === 'Escape') {
        e.preventDefault();
        setDrawingStart(null);
        setPolygonPoints([]);
        setNumericInput('');
        setDimP1(null);
        setDimP2(null);
        bimStore.setActiveTool('select');
        return;
      }

      // Desfazer: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        setDrawingStart(null);
        setPolygonPoints([]);
        setNumericInput('');
        setDimP1(null);
        setDimP2(null);
      }

      // Atalhos de Teclado de 2 letras no estilo Revit (WA, DR, WN, FL, RO, ST, RM, RS, DI, SC)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        // Se estiver no meio de entrada numérica para parede, letras não entram no numericInput
        shortcutBufferRef.current += e.key.toLowerCase();
        if (shortcutTimerRef.current) clearTimeout(shortcutTimerRef.current);
        shortcutTimerRef.current = setTimeout(() => {
          shortcutBufferRef.current = '';
        }, 900);

        const buf = shortcutBufferRef.current;
        const toolMap: Record<string, any> = {
          wa: 'wall',
          dr: 'door',
          wn: 'window',
          fl: 'floor',
          ro: 'roof',
          st: 'stair',
          rm: 'room',
          rs: 'roomSeparator',
          di: 'dimension',
          sc: 'section',
        };

        if (toolMap[buf]) {
          bimStore.setActiveTool(toolMap[buf]);
          setDrawingStart(null);
          setPolygonPoints([]);
          setNumericInput('');
          setDimP1(null);
          setDimP2(null);
          setSecP1(null);
          setSecP2(null);
          shortcutBufferRef.current = '';
          return;
        }

        if (shortcutBufferRef.current.length >= 2) {
          shortcutBufferRef.current = e.key.toLowerCase();
        }
      }

      if (e.key === 'Escape') {
        setDrawingStart(null);
        setPolygonPoints([]);
        setNumericInput('');
        setDimP1(null);
        setDimP2(null);
        setSecP1(null);
        setSecP2(null);
        bimStore.setActiveTool('select');
        return;
      }

      if (e.code === 'Space') {
        if (activeTool === 'door') {
          e.preventDefault();
          // Ciclo de 4 opções: (false, false) -> (false, true) -> (true, false) -> (true, true) -> (false, false)
          if (!doorFlipFacing && !doorFlipHand) {
            setDoorFlipHand(true);
          } else if (!doorFlipFacing && doorFlipHand) {
            setDoorFlipFacing(true);
            setDoorFlipHand(false);
          } else if (doorFlipFacing && !doorFlipHand) {
            setDoorFlipHand(true);
          } else {
            setDoorFlipFacing(false);
            setDoorFlipHand(false);
          }
        } else if (activeTool === 'select' && state.selectedElementIds.length > 0) {
          const selDoor = elements.doors.find((d) => state.selectedElementIds.includes(d.id));
          if (selDoor) {
            e.preventDefault();
            bimStore.flipDoor(selDoor.id);
          } else {
            isSpacePressedRef.current = true;
          }
        } else {
          isSpacePressedRef.current = true;
        }
      }

      if (e.key === 'F8') {
        e.preventDefault();
        bimStore.toggleOrtho();
        return;
      }

      // Entrada numérica direta ao desenhar paredes
      if (drawingStart && activeTool === 'wall') {
        if ((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === ',') {
          const char = e.key === ',' ? '.' : e.key;
          setNumericInput((prev) => prev + char);
        } else if (e.key === 'Backspace') {
          setNumericInput((prev) => prev.slice(0, -1));
        } else if (e.key === 'Enter') {
          const targetLength = parseFloat(numericInput);
          if (!isNaN(targetLength) && targetLength > 0.05 && currentSnapped) {
            const dx = currentSnapped.point.x - drawingStart.x;
            const dy = currentSnapped.point.y - drawingStart.y;
            const currentLen = Math.sqrt(dx * dx + dy * dy);

            let finalPoint: Point2D;
            if (currentLen > 0.001) {
              finalPoint = {
                x: drawingStart.x + (dx / currentLen) * targetLength,
                y: drawingStart.y + (dy / currentLen) * targetLength,
              };
            } else {
              finalPoint = { x: drawingStart.x + targetLength, y: drawingStart.y };
            }

            const newWall: WallElement = {
              id: `wall-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              type: 'wall',
              start: { ...drawingStart },
              end: finalPoint,
              thickness: defaults.wall.thickness,
              height: defaults.wall.height,
              levelId: activeLevelId,
            };
            bimStore.addWall(newWall);

            setDrawingStart(finalPoint);
            setNumericInput('');
          }
        }
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [
    drawingStart,
    currentSnapped,
    numericInput,
    activeTool,
    defaults,
    activeLevelId,
    doorFlipFacing,
    doorFlipHand,
    state.selectedElementIds,
    elements.doors,
  ]);

  // Manipulação de Ponteiro com setPointerCapture para Pan Confiável com Scroll e Botão Direito
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Botão do meio (1), botão direito (2) ou Tecla Espaço para Pan
    if (e.button === 1 || e.button === 2 || isSpacePressedRef.current) {
      e.preventDefault();
      isPanningRef.current = true;
      setIsPanning(true);
      startPanMouseRef.current = { x: e.clientX, y: e.clientY };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    // Clique Esquerdo (0) para Ações das Ferramentas BIM
    if (e.button === 0) {
      if (!currentSnapped) return;
      const clickPoint = currentSnapped.point;
      const rawWorld = rawWorldMouseRef.current;

      // 1. PAREDE (Wall)
      if (activeTool === 'wall') {
        if (!drawingStart) {
          setDrawingStart(clickPoint);
          setNumericInput('');
        } else {
          const length = distance(drawingStart, clickPoint);
          if (length > 0.05) {
            const newWall: WallElement = {
              id: `wall-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              type: 'wall',
              start: { ...drawingStart },
              end: { ...clickPoint },
              thickness: defaults.wall.thickness,
              height: defaults.wall.height,
              levelId: activeLevelId,
            };
            bimStore.addWall(newWall);
          }
          setDrawingStart(clickPoint);
          setNumericInput('');
        }
        return;
      }

      // 2. PORTA (Door)
      if (activeTool === 'door') {
        const host = findNearestHostWall(rawWorld, elements.walls, 1.2);
        if (host) {
          const newDoor: DoorElement = {
            id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'door',
            wallId: host.wall.id,
            offsetRatio: host.ratio,
            width: defaults.door.width,
            height: defaults.door.height,
            flipFacing: doorFlipFacing,
            flipHand: doorFlipHand,
            levelId: activeLevelId,
          };
          bimStore.addDoor(newDoor);
        }
        return;
      }

      // 3. JANELA (Window)
      if (activeTool === 'window') {
        const host = findNearestHostWall(rawWorld, elements.walls, 1.2);
        if (host) {
          const newWin: WindowElement = {
            id: `win-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'window',
            wallId: host.wall.id,
            offsetRatio: host.ratio,
            width: defaults.window.width,
            height: defaults.window.height,
            sillHeight: defaults.window.sillHeight,
            levelId: activeLevelId,
          };
          bimStore.addWindow(newWin);
        }
        return;
      }

      // 4. PISO / LAJE (Floor)
      if (activeTool === 'floor') {
        // Se clicar próximo ao primeiro vértice ou tiver mais de 2 pontos e fechar:
        if (polygonPoints.length >= 2 && distance(clickPoint, polygonPoints[0]) < 0.3) {
          const newFloor: FloorElement = {
            id: `floor-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'floor',
            polygon: [...polygonPoints],
            thickness: 0.15,
            elevationOffset: 0.0,
            levelId: activeLevelId,
          };
          bimStore.addFloor(newFloor);
          setPolygonPoints([]);
        } else {
          setPolygonPoints((prev) => [...prev, clickPoint]);
        }
        return;
      }

      // 5. TELHADO (Roof)
      if (activeTool === 'roof') {
        if (polygonPoints.length >= 2 && distance(clickPoint, polygonPoints[0]) < 0.3) {
          const newRoof: RoofElement = {
            id: `roof-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'roof',
            polygon: [...polygonPoints],
            pitch: 10,
            overhang: 0.6,
            levelId: activeLevelId,
          };
          bimStore.addRoof(newRoof);
          setPolygonPoints([]);
        } else {
          setPolygonPoints((prev) => [...prev, clickPoint]);
        }
        return;
      }

      // 6. ESCADA (Stair)
      if (activeTool === 'stair') {
        if (!drawingStart) {
          setDrawingStart(clickPoint);
        } else {
          const stairParams = computeStairParameters(2.8, 0.28);
          const newStair: StairElement = {
            id: `stair-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'stair',
            start: { ...drawingStart },
            end: { ...clickPoint },
            width: 0.9,
            riserHeight: stairParams.riserHeight,
            treadDepth: stairParams.treadDepth,
            stepsCount: stairParams.stepsCount,
            levelId: activeLevelId,
          };
          bimStore.addStair(newStair);
          setDrawingStart(null);
        }
        return;
      }

      // 7. AMBIENTE (Room)
      if (activeTool === 'room') {
        const poly = detectClosedRoomPolygon(rawWorld, elements.walls);
        if (poly && poly.length >= 3) {
          const area = computePolygonArea(poly);
          const defaultNames = ['Sala de Estar', 'Cozinha', 'Quarto 01', 'Quarto 02', 'Banheiro', 'Varanda'];
          const chosenName = defaultNames[elements.rooms.length % defaultNames.length];
          const newRoom: RoomElement = {
            id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'room',
            name: chosenName,
            polygon: poly,
            areaM2: area,
            levelId: activeLevelId,
          };
          bimStore.addRoom(newRoom);
        }
        return;
      }

      // 8. SEPARADOR DE AMBIENTE (Room Separator)
      if (activeTool === 'roomSeparator') {
        if (!drawingStart) {
          setDrawingStart(clickPoint);
        } else {
          const newSep: RoomSeparatorElement = {
            id: `sep-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'roomSeparator',
            start: { ...drawingStart },
            end: { ...clickPoint },
            levelId: activeLevelId,
          };
          bimStore.addRoomSeparator(newSep);
          setDrawingStart(null);
        }
        return;
      }

      // 9. COTA ALINHADA (Dimension)
      if (activeTool === 'dimension') {
        if (!dimP1) {
          setDimP1(clickPoint);
        } else if (!dimP2) {
          if (distance(dimP1, clickPoint) > 0.05) {
            setDimP2(clickPoint);
          }
        } else {
          // 3º clique: calcula offset perpendicular e cria a cota definitiva
          const dx = dimP2.x - dimP1.x;
          const dy = dimP2.y - dimP1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          let offset = 0.4;
          if (len > 0.05) {
            const nx = -dy / len;
            const ny = dx / len;
            offset = (clickPoint.x - dimP1.x) * nx + (clickPoint.y - dimP1.y) * ny;
            if (Math.abs(offset) < 0.08) offset = offset >= 0 ? 0.35 : -0.35;
          }
          const newDim: DimensionElement = {
            id: `dim-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'dimension',
            start: { ...dimP1 },
            end: { ...dimP2 },
            offset,
            levelId: activeLevelId,
          };
          bimStore.addDimension(newDim);
          setDimP1(null);
          setDimP2(null);
        }
        return;
      }

      // 10. LINHA DE CORTE (Section em 3 Cliques: P1 -> P2 -> Sentido/Profundidade)
      if (activeTool === 'section') {
        if (!secP1) {
          // 1º Clique: Ponto inicial
          setSecP1(clickPoint);
        } else if (!secP2) {
          // 2º Clique: Ponto final da linha de corte
          const len = distance(secP1, clickPoint);
          if (len > 0.25) {
            setSecP2(clickPoint);
          }
        } else {
          // 3º Clique: Direção de visão e profundidade conforme posição do cursor
          const sDx = secP2.x - secP1.x;
          const sDy = secP2.y - secP1.y;
          const sLen = Math.sqrt(sDx * sDx + sDy * sDy) || 1;
          const nx = -sDy / sLen;
          const ny = sDx / sLen;

          const vx = clickPoint.x - secP1.x;
          const vy = clickPoint.y - secP1.y;
          const side = vx * nx + vy * ny;
          const direction: 1 | -1 = side >= 0 ? 1 : -1;
          const farDepth = Math.max(0.6, Math.abs(side));

          const letter = String.fromCharCode(65 + elements.sections.length);
          const newSec: SectionElement = {
            id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'section',
            start: { ...secP1 },
            end: { ...secP2 },
            name: `Corte ${letter}-${letter}`,
            farClipDepth: farDepth,
            direction,
            levelId: activeLevelId,
          };

          bimStore.addSection(newSec);
          setSecP1(null);
          setSecP2(null);
          bimStore.setActiveSectionId(newSec.id);
          bimStore.setActiveView('section');
        }
        return;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mousePosScreenRef.current = screenPos;

    // Pan ativo
    if (isPanningRef.current) {
      const dx = (e.clientX - startPanMouseRef.current.x) / zoomRef.current;
      const dy = (e.clientY - startPanMouseRef.current.y) / zoomRef.current;

      panRef.current.x -= dx;
      panRef.current.y += dy;
      startPanMouseRef.current = { x: e.clientX, y: e.clientY };

      triggerRender();
      return;
    }

    const rawWorld = screenToWorld(e.clientX, e.clientY);
    rawWorldMouseRef.current = rawWorld;

    const snap = computeSnap(rawWorld, drawingStart, elements.walls, snapConfig, zoomRef.current);
    setCurrentSnapped(snap);

    if (onCursorMove) {
      onCursorMove(snap.point);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isPanning ? 'grabbing' : 'crosshair',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onAuxClick={(e) => e.preventDefault()}
      />

      {/* Caixa de Entrada Numérica Dinâmica Flutuante para Parede */}
      {drawingStart && activeTool === 'wall' && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(20, 27, 38, 0.95)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Digite a distância (m):</span>
          <div
            style={{
              minWidth: 70,
              padding: '4px 10px',
              background: 'var(--bg-main)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--cad-blue)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--cad-cyan)',
              textAlign: 'center',
            }}
          >
            {numericInput || '0.00'}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Pressione [Enter] para confirmar</span>
        </div>
      )}

      {/* Barra de Ajuda / Conclusão para Polígonos de Piso ou Telhado */}
      {(activeTool === 'floor' || activeTool === 'roof') && polygonPoints.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(20, 27, 38, 0.95)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-main)' }}>
            Vértices: {polygonPoints.length} • Clique no 1º ponto para fechar
          </span>
          {polygonPoints.length >= 3 && (
            <button
              className="btn-primary"
              onClick={() => {
                if (activeTool === 'floor') {
                  bimStore.addFloor({
                    id: `floor-${Date.now()}`,
                    type: 'floor',
                    polygon: [...polygonPoints],
                    thickness: 0.15,
                    elevationOffset: 0.0,
                    levelId: activeLevelId,
                  });
                } else {
                  bimStore.addRoof({
                    id: `roof-${Date.now()}`,
                    type: 'roof',
                    polygon: [...polygonPoints],
                    pitch: 10,
                    overhang: 0.6,
                    levelId: activeLevelId,
                  });
                }
                setPolygonPoints([]);
              }}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Concluir Contorno
            </button>
          )}
        </div>
      )}
    </div>
  );
};

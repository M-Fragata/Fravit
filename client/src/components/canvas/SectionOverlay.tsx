import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import type { Point2D, DimensionElement } from '../../cad-core/types';
import { drawRevitDimension } from '../../cad-core/geometry/revitDimension';

interface SectionOverlayProps {
  sectionPanRef: React.MutableRefObject<{ u: number; z: number }>;
  zoomRef: React.MutableRefObject<number>;
  triggerRender: () => void;
  onCursorMove?: (worldPos: Point2D) => void;
}

interface SectionSnapTarget {
  z: number;
  label: string;
  type: 'level' | 'wall_top' | 'opening';
}

export const SectionOverlay: React.FC<SectionOverlayProps> = ({
  sectionPanRef,
  zoomRef,
  triggerRender,
  onCursorMove,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useBIM();
  const { activeTool, activeLevelId, activeSectionId, elements, levels } = state;

  const currentSection =
    elements.sections.find((s) => s.id === activeSectionId) || elements.sections[0];

  // Estados de cotagem interativa no corte (coordenadas u, z em metros)
  const [secDimP1, setSecDimP1] = useState<{ u: number; z: number } | null>(null);
  const [secDimP2, setSecDimP2] = useState<{ u: number; z: number } | null>(null);
  const [currentSectionSnap, setCurrentSectionSnap] = useState<{
    point: { u: number; z: number };
    label?: string;
  } | null>(null);

  const rawMousePosRef = useRef<{ x: number; y: number }>({ x: -100, y: -100 });
  const isDraggingPanRef = useRef<boolean>(false);
  const startDragMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  // Conversores de Coordenadas: Espaço de Seção (u: horizontal, z: elevação) <-> Tela
  const sectionToScreen = useCallback(
    (u: number, z: number): Point2D => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const zoom = zoomRef.current;

      const sx = centerX + (u - sectionPanRef.current.u) * zoom;
      const sy = centerY - (z - sectionPanRef.current.z) * zoom;
      return { x: sx, y: sy };
    },
    [sectionPanRef, zoomRef]
  );

  const screenToSection = useCallback(
    (sx: number, sy: number): { u: number; z: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { u: 0, z: 0 };
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const zoom = zoomRef.current;

      const u = sectionPanRef.current.u + (sx - centerX) / zoom;
      const z = sectionPanRef.current.z - (sy - centerY) / zoom;
      return { u, z };
    },
    [sectionPanRef, zoomRef]
  );

  // Lista de pontos de snap verticais na seção
  const getSnapTargets = useCallback((): SectionSnapTarget[] => {
    const targets: SectionSnapTarget[] = [];

    // Níveis
    levels.forEach((lvl) => {
      targets.push({
        z: lvl.elevation,
        label: `${lvl.name} (${lvl.elevation.toFixed(2)}m)`,
        type: 'level',
      });
    });

    // Topo de paredes
    elements.walls.forEach((w) => {
      const lvl = levels.find((l) => l.id === w.levelId) || levels[0];
      const topZ = (lvl?.elevation || 0) + (w.height || 2.8);
      if (!targets.some((t) => Math.abs(t.z - topZ) < 0.01)) {
        targets.push({
          z: topZ,
          label: `Topo Parede (${topZ.toFixed(2)}m)`,
          type: 'wall_top',
        });
      }
    });

    // Aberturas (peitoris e dintéis)
    elements.windows.forEach((win) => {
      const lvl = levels.find((l) => l.id === win.levelId) || levels[0];
      const sillZ = (lvl?.elevation || 0) + win.sillHeight;
      const lintelZ = sillZ + win.height;
      if (!targets.some((t) => Math.abs(t.z - sillZ) < 0.01)) {
        targets.push({
          z: sillZ,
          label: `Peitoril (${sillZ.toFixed(2)}m)`,
          type: 'opening',
        });
      }
      if (!targets.some((t) => Math.abs(t.z - lintelZ) < 0.01)) {
        targets.push({
          z: lintelZ,
          label: `Dintel Janela (${lintelZ.toFixed(2)}m)`,
          type: 'opening',
        });
      }
    });

    elements.doors.forEach((door) => {
      const lvl = levels.find((l) => l.id === door.levelId) || levels[0];
      const lintelZ = (lvl?.elevation || 0) + door.height;
      if (!targets.some((t) => Math.abs(t.z - lintelZ) < 0.01)) {
        targets.push({
          z: lintelZ,
          label: `Vão Porta (${lintelZ.toFixed(2)}m)`,
          type: 'opening',
        });
      }
    });

    return targets;
  }, [levels, elements.walls, elements.windows, elements.doors]);

  // Loop de Renderização no Canvas da Seção
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!currentSection) return;

      const snapped = currentSectionSnap?.point;

      // ==========================================
      // A. Cotas Técnicas do Corte Salvas
      // ==========================================
      const secDimensions = elements.dimensions.filter(
        (d) => d.view === 'section' && (!d.sectionId || d.sectionId === currentSection.id)
      );

      secDimensions.forEach((dim) => {
        const p1Screen = sectionToScreen(dim.start.x, dim.start.y);
        const p2Screen = sectionToScreen(dim.end.x, dim.end.y);

        const dz = dim.end.y - dim.start.y;
        const du = dim.end.x - dim.start.x;
        const len = Math.hypot(du, dz);
        if (len < 0.01) return;

        // Deslocamento da cota horizontal ou perpendicular
        const offsetPx = (dim.offset || 0.4) * zoomRef.current;
        const sc1 = { x: p1Screen.x + offsetPx, y: p1Screen.y };
        const sc2 = { x: p2Screen.x + offsetPx, y: p2Screen.y };

        drawRevitDimension(ctx, p1Screen, p2Screen, sc1, sc2, len);
      });

      // ==========================================
      // B. Preview Interativo da Ferramenta Cota (DI)
      // ==========================================
      if (activeTool === 'dimension' && snapped) {
        if (!secDimP1) {
          // Fase 1: Seleção do Primeiro Ponto
          const sPos = sectionToScreen(snapped.u, snapped.z);

          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sPos.x, sPos.y, 6, 0, Math.PI * 2);
          ctx.stroke();

          // Dica Flutuante
          const label = currentSectionSnap?.label || 'Clique no primeiro ponto da cota no corte';
          ctx.font = '500 11px "Inter", sans-serif';
          const lw = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = '#38bdf8';
          ctx.beginPath();
          ctx.roundRect(sPos.x - lw / 2 - 8, sPos.y - 30, lw + 16, 22, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, sPos.x, sPos.y - 19);
          ctx.restore();
        } else if (secDimP1 && !secDimP2) {
          // Fase 2: Seleção do Segundo Ponto
          const s1 = sectionToScreen(secDimP1.u, secDimP1.z);
          const s2 = sectionToScreen(snapped.u, snapped.z);

          const dz = Math.abs(snapped.z - secDimP1.z);

          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();
          ctx.restore();

          // Dica Flutuante com Altura em Metros
          const label = `${dz.toFixed(2)} • Clique no segundo ponto do corte`;
          ctx.save();
          ctx.font = '500 11px "Inter", sans-serif';
          const lw = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = '#38bdf8';
          ctx.beginPath();
          ctx.roundRect(s2.x - lw / 2 - 8, s2.y - 30, lw + 16, 22, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, s2.x, s2.y - 19);
          ctx.restore();
        } else if (secDimP1 && secDimP2) {
          // Fase 3: Definição do Offset da Cota
          const s1 = sectionToScreen(secDimP1.u, secDimP1.z);
          const s2 = sectionToScreen(secDimP2.u, secDimP2.z);

          const curPos = sectionToScreen(snapped.u, snapped.z);
          const offsetPx = curPos.x - (s1.x + s2.x) / 2;

          const sc1 = { x: s1.x + offsetPx, y: s1.y };
          const sc2 = { x: s2.x + offsetPx, y: s2.y };

          const len = Math.hypot(secDimP2.u - secDimP1.u, secDimP2.z - secDimP1.z);

          drawRevitDimension(ctx, s1, s2, sc1, sc2, len, {
            extraNote: 'Clique para fixar posição da cota',
          });
        }
      }

      // ==========================================
      // C. Crosshair e Indicador de Snap
      // ==========================================
      if (snapped && activeTool === 'dimension') {
        const sScreen = sectionToScreen(snapped.u, snapped.z);
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Linha guia horizontal na elevação
        ctx.beginPath();
        ctx.moveTo(0, sScreen.y);
        ctx.lineTo(canvas.width, sScreen.y);
        ctx.stroke();

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [
    currentSection,
    elements.dimensions,
    activeTool,
    secDimP1,
    secDimP2,
    currentSectionSnap,
    sectionToScreen,
    zoomRef,
  ]);

  // Interações de Mouse e Teclado
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    rawMousePosRef.current = { x: sx, y: sy };

    // Pan no Corte
    if (isDraggingPanRef.current) {
      const dx = sx - startDragMouseRef.current.x;
      const dy = sy - startDragMouseRef.current.y;
      startDragMouseRef.current = { x: sx, y: sy };

      sectionPanRef.current.u -= dx / zoomRef.current;
      sectionPanRef.current.z += dy / zoomRef.current;
      triggerRender();
      return;
    }

    const { u, z } = screenToSection(sx, sy);
    if (onCursorMove) {
      onCursorMove({ x: u, y: z });
    }

    // Snapping em elevações de níveis e elementos cortados
    const targets = getSnapTargets();
    let bestTarget: SectionSnapTarget | null = null;
    let minPixDist = 16; // limite de 16px para atrair

    for (const tgt of targets) {
      const tgtScreenY = sectionToScreen(u, tgt.z).y;
      const dist = Math.abs(sy - tgtScreenY);
      if (dist < minPixDist) {
        minPixDist = dist;
        bestTarget = tgt;
      }
    }

    let snappedU = u;
    const snappedZ = bestTarget ? bestTarget.z : z;
    const label = bestTarget ? bestTarget.label : undefined;

    // Alinhamento vertical ortho com o P1 se já estiver selecionado
    if (secDimP1 && !secDimP2) {
      const p1ScreenX = sectionToScreen(secDimP1.u, secDimP1.z).x;
      if (Math.abs(sx - p1ScreenX) < 20) {
        snappedU = secDimP1.u;
      }
    }

    setCurrentSectionSnap({
      point: { u: snappedU, z: snappedZ },
      label,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Pan com botão do meio (1) ou direito (2)
    if (e.button === 1 || e.button === 2) {
      isDraggingPanRef.current = true;
      startDragMouseRef.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
      return;
    }

    // Clique esquerdo (0)
    if (e.button === 0) {
      if (activeTool === 'dimension') {
        const snapped = currentSectionSnap?.point;
        if (!snapped) return;

        if (!secDimP1) {
          setSecDimP1({ ...snapped });
        } else if (secDimP1 && !secDimP2) {
          setSecDimP2({ ...snapped });
        } else if (secDimP1 && secDimP2 && currentSection) {
          // Finaliza a cota do corte
          const offset = snapped.u - (secDimP1.u + secDimP2.u) / 2;
          const newSecDim: DimensionElement = {
            id: `dim-sec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'dimension',
            start: { x: secDimP1.u, y: secDimP1.z },
            end: { x: secDimP2.u, y: secDimP2.z },
            offset,
            levelId: activeLevelId,
            view: 'section',
            sectionId: currentSection.id,
          };
          bimStore.addDimension(newSecDim);

          setSecDimP1(null);
          setSecDimP2(null);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingPanRef.current) {
      isDraggingPanRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Teclado global para Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSecDimP1(null);
        setSecDimP2(null);
        bimStore.setActiveTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        cursor: activeTool === 'dimension' ? 'crosshair' : 'default',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
};

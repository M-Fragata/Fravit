import React, { useRef, useEffect, useState } from 'react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import { computeSnap, distance } from '../../cad-core/snaps/snapEngine';
import type { Point2D, SnapResult, WallElement } from '../../cad-core/types';

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

  // Estado de desenho interativo
  const [drawingStart, setDrawingStart] = useState<Point2D | null>(null);
  const [currentSnapped, setCurrentSnapped] = useState<SnapResult | null>(null);
  const [numericInput, setNumericInput] = useState<string>('');

  const mousePosScreenRef = useRef<{ x: number; y: number }>({ x: -100, y: -100 });
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

  // 2. Renderização das guias, mira técnica e feedback no Canvas 2D
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

      if (snapped) {
        const screenSnap = worldToScreen(snapped.x, snapped.y);

        // A. Linha Elástica (Rubberband) ao desenhar parede
        if (drawingStart && activeTool === 'wall') {
          const screenStart = worldToScreen(drawingStart.x, drawingStart.y);

          // Traço da parede em criação
          ctx.beginPath();
          ctx.moveTo(screenStart.x, screenStart.y);
          ctx.lineTo(screenSnap.x, screenSnap.y);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = Math.max(3, defaults.wall.thickness * zoom);
          ctx.lineCap = 'round';
          ctx.stroke();

          // Medida dinâmica flutuante com indicador de ângulo polar (ex: 45°)
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

        // B. Guias Polares (Raios pontilhados estendidos nos ângulos de 45°)
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

        // C. Marcadores de Snap Magnético
        if (currentSnapped) {
          if (currentSnapped.type === 'endpoint') {
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
        }
      }

      // D. Mira Técnica CAD (Crosshair)
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
  }, [drawingStart, currentSnapped, activeTool, defaults, worldToScreen, zoomRef]);

  // 3. Captura Global de Teclado (F8 para Orto, Escape para Cancelar, Tecla Espaço para Pan, Entrada Numérica direta)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = true;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        bimStore.toggleOrtho();
        return;
      }

      if (e.key === 'Escape') {
        setDrawingStart(null);
        setNumericInput('');
        return;
      }

      // Entrada numérica direta ao desenhar
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
  }, [drawingStart, currentSnapped, numericInput, activeTool, defaults, activeLevelId]);

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

    // Clique Esquerdo (0) para desenhar paredes
    if (e.button === 0) {
      if (!currentSnapped) return;
      const clickPoint = currentSnapped.point;

      if (activeTool === 'wall') {
        if (!drawingStart) {
          // 1º Clique: Fixa ponto inicial
          setDrawingStart(clickPoint);
          setNumericInput('');
        } else {
          // 2º Clique: Salva parede na posição exata
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

          // Encadeamento contínuo: próximo lance começa exatamente deste ponto
          setDrawingStart(clickPoint);
          setNumericInput('');
        }
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mousePosScreenRef.current = screenPos;

    // Pan ativo: arrasto com botão do meio, direito ou espaço
    if (isPanningRef.current) {
      const dx = (e.clientX - startPanMouseRef.current.x) / zoomRef.current;
      const dy = (e.clientY - startPanMouseRef.current.y) / zoomRef.current;

      panRef.current.x -= dx;
      panRef.current.y += dy; // Inversão para manter orientação cartesiada Y para cima
      startPanMouseRef.current = { x: e.clientX, y: e.clientY };

      triggerRender();
      return;
    }

    const rawWorld = screenToWorld(e.clientX, e.clientY);
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

      {/* Caixa de Entrada Numérica Dinâmica Flutuante */}
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
    </div>
  );
};

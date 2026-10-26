import React, { useRef, useEffect, useState } from 'react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import { computeSnap, distance } from '../../cad-core/snaps/snapEngine';
import type { Point2D, SnapResult, WallElement } from '../../cad-core/types';

interface CanvasOverlayProps {
  zoom: number;
  pan: Point2D;
  setPan: React.Dispatch<React.SetStateAction<Point2D>>;
  screenToWorld: (x: number, y: number) => Point2D;
  worldToScreen: (x: number, y: number) => Point2D;
  onCursorMove?: (worldPos: Point2D) => void;
}

export const CanvasOverlay: React.FC<CanvasOverlayProps> = ({
  zoom,
  setPan,
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
  const isPanningRef = useRef<boolean>(false);
  const lastPanMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Manter dimensões do Canvas sincronizadas com o container via ResizeObserver
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

          // Medida dinâmica flutuante
          const distMeters = distance(drawingStart, snapped);
          const midX = (screenStart.x + screenSnap.x) / 2;
          const midY = (screenStart.y + screenSnap.y) / 2;

          ctx.fillStyle = 'rgba(12, 16, 23, 0.95)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          const label = `${distMeters.toFixed(2)} m`;
          ctx.font = '700 13px "JetBrains Mono", monospace';
          const textWidth = ctx.measureText(label).width;

          ctx.beginPath();
          ctx.roundRect(midX - textWidth / 2 - 10, midY - 26, textWidth + 20, 24, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, midX, midY - 14);
        }

        // B. Guias Polares (Raios pontilhados em 45°)
        if (currentSnapped?.guideLines) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
          ctx.lineWidth = 1.5;

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
      if (mouse.x > 0 && mouse.y > 0) {
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
  }, [drawingStart, currentSnapped, activeTool, defaults, worldToScreen, zoom]);

  // 3. Captura Global de Teclado (F8 para Orto, Escape para Cancelar, Entrada Numérica direta)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Alternar Modo Orto com tecla F8
      if (e.key === 'F8') {
        e.preventDefault();
        bimStore.toggleOrtho();
        return;
      }

      // Cancelar desenho com tecla Escape
      if (e.key === 'Escape') {
        setDrawingStart(null);
        setNumericInput('');
        return;
      }

      // Digitar medidas diretamente no teclado durante o desenho
      if (drawingStart && activeTool === 'wall') {
        if ((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === ',') {
          const char = e.key === ',' ? '.' : e.key;
          setNumericInput((prev) => prev + char);
        } else if (e.key === 'Backspace') {
          setNumericInput((prev) => prev.slice(0, -1));
        } else if (e.key === 'Enter') {
          // Confirmar comprimento digitado
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

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [drawingStart, currentSnapped, numericInput, activeTool, defaults, activeLevelId]);

  // Manipulação de Mouse
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mousePosScreenRef.current = screenPos;

    // Pan no 2D (botão do meio ou direito pressionado)
    if (isPanningRef.current) {
      const dx = (e.clientX - lastPanMouseRef.current.x) / zoom;
      const dy = (e.clientY - lastPanMouseRef.current.y) / zoom;
      setPan((prev) => ({
        x: prev.x - dx,
        y: prev.y + dy,
      }));
      lastPanMouseRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const rawWorld = screenToWorld(e.clientX, e.clientY);
    const snap = computeSnap(rawWorld, drawingStart, elements.walls, snapConfig, zoom);
    setCurrentSnapped(snap);

    if (onCursorMove) {
      onCursorMove(snap.point);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pan: Botão do meio (1) ou Botão direito (2)
    if (e.button === 1 || e.button === 2) {
      isPanningRef.current = true;
      lastPanMouseRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    // Clique Esquerdo (0)
    if (e.button === 0) {
      if (!currentSnapped) return;
      const clickPoint = currentSnapped.point;

      // Desenho de Parede
      if (activeTool === 'wall') {
        if (!drawingStart) {
          // 1º Clique: Ponto inicial da parede
          setDrawingStart(clickPoint);
          setNumericInput('');
        } else {
          // 2º Clique: Adiciona parede ao modelo BIM
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

          // Encadeamento contínuo (pronto para o próximo lance de parede)
          setDrawingStart(clickPoint);
          setNumericInput('');
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2) {
      isPanningRef.current = false;
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
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

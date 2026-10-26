import React, { useRef, useEffect, useState } from 'react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import { computeSnap, distance } from '../../cad-core/snaps/snapEngine';
import type { Point2D, SnapResult, WallElement } from '../../cad-core/types';

interface CanvasOverlayProps {
  zoom: number;
  pan: Point2D;
  screenToWorld: (x: number, y: number) => Point2D;
  worldToScreen: (x: number, y: number) => Point2D;
}

export const CanvasOverlay: React.FC<CanvasOverlayProps> = ({
  zoom,
  screenToWorld,
  worldToScreen,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useBIM();
  const { activeTool, activeLevelId, elements, snapConfig, defaults } = state;

  // Estado de desenho interativo
  const [drawingStart, setDrawingStart] = useState<Point2D | null>(null);
  const [currentSnapped, setCurrentSnapped] = useState<SnapResult | null>(null);
  const [numericInput, setNumericInput] = useState<string>('');
  const [isTypingLength, setIsTypingLength] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mousePosScreenRef = useRef<{ x: number; y: number }>({ x: -100, y: -100 });

  // 1. Renderização do Canvas Overlay em Alta Resolução
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

      // Se temos um ponto snapped, desenhar elementos de auxílio
      if (snapped) {
        const screenSnap = worldToScreen(snapped.x, snapped.y);

        // A. Se estiver desenhando uma parede (Linha Elástica / Rubberband)
        if (drawingStart && activeTool === 'wall') {
          const screenStart = worldToScreen(drawingStart.x, drawingStart.y);

          // Linha guia elástica
          ctx.beginPath();
          ctx.moveTo(screenStart.x, screenStart.y);
          ctx.lineTo(screenSnap.x, screenSnap.y);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = Math.max(1, defaults.wall.thickness * zoom);
          ctx.lineCap = 'round';
          ctx.stroke();

          // Linha de cota temporária
          const distMeters = distance(drawingStart, snapped);
          const midX = (screenStart.x + screenSnap.x) / 2;
          const midY = (screenStart.y + screenSnap.y) / 2;

          ctx.fillStyle = 'rgba(12, 16, 23, 0.9)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          const label = `${distMeters.toFixed(2)} m`;
          ctx.font = '600 12px "JetBrains Mono", monospace';
          const textWidth = ctx.measureText(label).width;

          ctx.beginPath();
          ctx.roundRect(midX - textWidth / 2 - 8, midY - 24, textWidth + 16, 22, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, midX, midY - 13);
        }

        // B. Guias Polares (Raios pontilhados)
        if (currentSnapped?.guideLines) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
          ctx.lineWidth = 1;

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
            // Quadrado verde de extremidade (Endpoint)
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenSnap.x - 6, screenSnap.y - 6, 12, 12);
          } else if (currentSnapped.type === 'midpoint') {
            // Triângulo verde de ponto médio (Midpoint)
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screenSnap.x, screenSnap.y - 7);
            ctx.lineTo(screenSnap.x + 7, screenSnap.y + 6);
            ctx.lineTo(screenSnap.x - 7, screenSnap.y + 6);
            ctx.closePath();
            ctx.stroke();
          } else if (currentSnapped.type === 'grid') {
            // Pequeno círculo / cruz de grid
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(screenSnap.x, screenSnap.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // D. Mira Técnica CAD (Crosshair)
      if (mouse.x > 0 && mouse.y > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;

        // Linha horizontal
        ctx.beginPath();
        ctx.moveTo(mouse.x - 14, mouse.y);
        ctx.lineTo(mouse.x + 14, mouse.y);
        ctx.stroke();

        // Linha vertical
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y - 14);
        ctx.lineTo(mouse.x, mouse.y + 14);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, [drawingStart, currentSnapped, activeTool, defaults, worldToScreen, zoom]);

  // Redimensionamento do canvas overlay
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !canvasRef.current.parentElement) return;
      canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
      canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Manipulação de Mouse
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mousePosScreenRef.current = screenPos;

    const rawWorld = screenToWorld(e.clientX, e.clientY);
    const snap = computeSnap(rawWorld, drawingStart, elements.walls, snapConfig, zoom);
    setCurrentSnapped(snap);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Apenas botão esquerdo dispara ações de desenho
    if (e.button !== 0) {
      if (e.button === 2) {
        // Botão direito cancela ação atual
        setDrawingStart(null);
        setIsTypingLength(false);
        setNumericInput('');
      }
      return;
    }

    if (!currentSnapped) return;
    const clickPoint = currentSnapped.point;

    // Ferramenta de Parede (Wall Tool)
    if (activeTool === 'wall') {
      if (!drawingStart) {
        // 1º Clique: Ponto inicial da parede
        setDrawingStart(clickPoint);
        setIsTypingLength(true);
      } else {
        // 2º Clique: Finalizar parede
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

        // Desenho contínuo encadeado (estilo Revit)
        setDrawingStart(clickPoint);
        setNumericInput('');
      }
    }
  };

  // Suporte a Entrada Numérica Direta (digitar comprimento ex: 4.5 e teclar Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDrawingStart(null);
      setIsTypingLength(false);
      setNumericInput('');
      return;
    }

    if (e.key === 'Enter' && drawingStart && currentSnapped) {
      const targetLength = parseFloat(numericInput);
      if (!isNaN(targetLength) && targetLength > 0.05) {
        // Calcula vetor unitário na direção atual do cursor
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
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Caixa de Entrada Numérica Dinâmica Flutuante */}
      {isTypingLength && drawingStart && (
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
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Comprimento (m):</span>
          <input
            ref={inputRef}
            type="number"
            step="0.05"
            autoFocus
            placeholder="Ex: 4.50"
            value={numericInput}
            onChange={(e) => setNumericInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: 100,
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--cad-cyan)',
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Pressione [Enter] para confirmar</span>
        </div>
      )}
    </div>
  );
};

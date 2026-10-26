import React from 'react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import type { Point2D } from '../../cad-core/types';
import { Compass, Magnet, Grid } from 'lucide-react';

interface CADStatusBarProps {
  cursorPos: Point2D;
}

export const CADStatusBar: React.FC<CADStatusBarProps> = ({ cursorPos }) => {
  const { snapConfig, levels, activeLevelId } = useBIM();
  const currentLevel = levels.find((l) => l.id === activeLevelId) || levels[0];

  return (
    <footer
      style={{
        height: '32px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        userSelect: 'none',
        zIndex: 20,
      }}
    >
      {/* Coordenadas de Mundo em Metros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'var(--font-mono)' }}>
        <span>
          X: <strong style={{ color: 'var(--text-main)' }}>{cursorPos.x >= 0 ? `+${cursorPos.x.toFixed(2)}` : cursorPos.x.toFixed(2)}m</strong>
        </span>
        <span>
          Y: <strong style={{ color: 'var(--text-main)' }}>{cursorPos.y >= 0 ? `+${cursorPos.y.toFixed(2)}` : cursorPos.y.toFixed(2)}m</strong>
        </span>
        <span style={{ color: 'var(--border-color)' }}>|</span>
        <span style={{ color: 'var(--cad-cyan)' }}>
          {currentLevel ? `${currentLevel.name} (+${currentLevel.elevation.toFixed(2)}m)` : 'Nível 1'}
        </span>
      </div>

      {/* Botões de Precisão / Snaps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Orto Mode */}
        <button
          onClick={() => bimStore.toggleOrtho()}
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 600,
            background: snapConfig.orthoMode ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
            border: `1px solid ${snapConfig.orthoMode ? 'var(--cad-blue)' : 'var(--border-color)'}`,
            color: snapConfig.orthoMode ? 'var(--cad-cyan)' : 'var(--text-dim)',
          }}
          title="Modo Ortogonal (Trava eixos 0°, 90°, 180°, 270°) [F8 / Shift]"
        >
          ORTO [F8]
        </button>

        {/* Polar Tracking */}
        <button
          onClick={() => bimStore.togglePolar()}
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 600,
            background: snapConfig.polarTracking ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
            border: `1px solid ${snapConfig.polarTracking ? 'var(--cad-blue)' : 'var(--border-color)'}`,
            color: snapConfig.polarTracking ? 'var(--cad-cyan)' : 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Rastreamento Polar (Guias a cada 45°)"
        >
          <Compass size={12} />
          <span>POLAR (45°)</span>
        </button>

        {/* Object Snap */}
        <button
          onClick={() => bimStore.toggleObjectSnap()}
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 600,
            background: snapConfig.objectSnap ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            border: `1px solid ${snapConfig.objectSnap ? 'var(--cad-green)' : 'var(--border-color)'}`,
            color: snapConfig.objectSnap ? '#10b981' : 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Snap a Objetos (Extremidades e Pontos Médios) [F3]"
        >
          <Magnet size={12} />
          <span>OSNAP</span>
        </button>

        {/* Grid Snap */}
        <button
          onClick={() => bimStore.toggleGridSnap()}
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 600,
            background: snapConfig.gridSnap ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            border: `1px solid ${snapConfig.gridSnap ? 'var(--cad-cyan)' : 'var(--border-color)'}`,
            color: snapConfig.gridSnap ? 'var(--cad-cyan)' : 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Snap a Grade (10 cm) [F9]"
        >
          <Grid size={12} />
          <span>GRID (0.1m)</span>
        </button>
      </div>
    </footer>
  );
};

import React from 'react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import type { ToolType } from '../../cad-core/types';
import {
  MousePointer,
  Square,
  DoorOpen,
  Maximize2,
  Layers,
  Home,
  TrendingUp,
  Tag,
  Minus,
  Ruler,
  Scissors,
  Undo2,
  Redo2,
} from 'lucide-react';

export const CADToolbar: React.FC = () => {
  const { activeTool, history } = useBIM();

  const tools: { id: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'select', label: 'Modificar / Selecionar', icon: <MousePointer size={18} />, shortcut: 'Esc' },
    { id: 'wall', label: 'Parede Arquitetônica', icon: <Square size={18} />, shortcut: 'WA' },
    { id: 'door', label: 'Porta', icon: <DoorOpen size={18} />, shortcut: 'DR' },
    { id: 'window', label: 'Janela', icon: <Maximize2 size={18} />, shortcut: 'WN' },
    { id: 'floor', label: 'Piso / Laje', icon: <Layers size={18} />, shortcut: 'FL' },
    { id: 'roof', label: 'Telhado / Cobertura', icon: <Home size={18} />, shortcut: 'RO' },
    { id: 'stair', label: 'Escada', icon: <TrendingUp size={18} />, shortcut: 'ST' },
    { id: 'room', label: 'Ambiente com Área m²', icon: <Tag size={18} />, shortcut: 'RM' },
    { id: 'roomSeparator', label: 'Separador de Ambiente', icon: <Minus size={18} />, shortcut: 'RS' },
    { id: 'dimension', label: 'Cota Alinhada', icon: <Ruler size={18} />, shortcut: 'DI' },
    { id: 'section', label: 'Corte (Section)', icon: <Scissors size={18} />, shortcut: 'SC' },
  ];

  return (
    <aside
      style={{
        width: '56px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        zIndex: 10,
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tools.map((t) => {
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => bimStore.setActiveTool(t.id)}
              title={`${t.label} (${t.shortcut})`}
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive ? 'var(--cad-blue)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {t.icon}
            </button>
          );
        })}
      </div>

      {/* Histórico: Desfazer / Refazer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
        <button
          onClick={() => bimStore.undo()}
          disabled={history.past.length === 0}
          title="Desfazer (Ctrl+Z)"
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            color: history.past.length > 0 ? 'var(--text-main)' : 'var(--text-dim)',
            opacity: history.past.length > 0 ? 1 : 0.4,
          }}
        >
          <Undo2 size={16} />
        </button>

        <button
          onClick={() => bimStore.redo()}
          disabled={history.future.length === 0}
          title="Refazer (Ctrl+Y)"
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            color: history.future.length > 0 ? 'var(--text-main)' : 'var(--text-dim)',
            opacity: history.future.length > 0 ? 1 : 0.4,
          }}
        >
          <Redo2 size={16} />
        </button>
      </div>
    </aside>
  );
};

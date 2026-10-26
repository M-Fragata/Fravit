import React, { useState, useEffect, useCallback } from 'react';
import type { ProjectDetail } from '../../types';
import type { Point2D } from '../../cad-core/types';
import { projectService } from '../../services/api';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import { CADViewport } from '../canvas/CADViewport';
import { CADToolbar } from '../layout/CADToolbar';
import { CADStatusBar } from '../layout/CADStatusBar';
import { PropertiesPanel } from '../properties/PropertiesPanel';
import {
  ArrowLeft,
  Save,
  Download,
  Box,
  Square,
  Layers,
  Scissors,
} from 'lucide-react';

interface EditorPreviewProps {
  projectId: string;
  onBack: () => void;
}

export const EditorPreview: React.FC<EditorPreviewProps> = ({ projectId, onBack }) => {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursorPos, setCursorPos] = useState<Point2D>({ x: 0, y: 0 });

  const { activeView, levels, activeLevelId, elements } = useBIM();

  useEffect(() => {
    let isMounted = true;
    async function loadProject() {
      try {
        if (isMounted) setLoading(true);
        const data = await projectService.get(projectId);
        if (isMounted) {
          setProject(data);
          // Inicializar bimStore com dados do projeto
          bimStore.loadProjectData(data.bimData);
        }
      } catch (err: any) {
        alert(err.message || 'Erro ao carregar projeto.');
        onBack();
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadProject();
    return () => {
      isMounted = false;
    };
  }, [projectId, onBack]);

  const handleSave = useCallback(async () => {
    if (!project) return;
    try {
      const updatedBimData = {
        version: '1.0.0',
        meta: {
          projectName: project.title,
          author: 'Arquiteto',
          unit: 'm',
          createdAt: project.createdAt,
        },
        activeLevelId,
        levels,
        elements,
        sheets: [],
      };

      await projectService.update(project.id, {
        bimData: updatedBimData,
      });

      alert('Projeto salvo com sucesso no banco de dados SQLite!');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar projeto.');
    }
  }, [project, activeLevelId, levels, elements]);

  // Atalhos Globais de Teclado (Ctrl+Z para Desfazer, Ctrl+Shift+Z / Ctrl+Y para Refazer, Ctrl+S para Salvar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // Desfazer: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          bimStore.redo();
        } else {
          bimStore.undo();
        }
        return;
      }

      // Refazer: Ctrl+Y / Cmd+Y
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        bimStore.redo();
        return;
      }

      // Tecla Escape: cancela ferramentas e vai para select
      if (e.key === 'Escape') {
        bimStore.setActiveTool('select');
        return;
      }

      // Atalhos Revit de 2 Letras
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        (window as any).__revitShortcut = ((window as any).__revitShortcut || '') + e.key.toLowerCase();
        if ((window as any).__revitTimer) clearTimeout((window as any).__revitTimer);
        (window as any).__revitTimer = setTimeout(() => {
          (window as any).__revitShortcut = '';
        }, 900);

        const buf = (window as any).__revitShortcut;
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
          (window as any).__revitShortcut = '';
          return;
        }

        if ((window as any).__revitShortcut.length >= 2) {
          (window as any).__revitShortcut = e.key.toLowerCase();
        }
      }

      // Salvar: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, activeLevelId, levels, elements, handleSave]);

  if (loading || !project) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: 8 }}>Carregando modelo BIM Fravit...</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Preparando motor gráfico WebGL e precisão técnica</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Barra Superior do Editor */}
      <header
        style={{
          height: '56px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          zIndex: 30,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary"
            onClick={onBack}
            style={{ padding: '6px 12px', fontSize: '13px' }}
            title="Voltar ao Painel"
          >
            <ArrowLeft size={16} />
            <span>Projetos</span>
          </button>

          <div style={{ height: 20, width: 1, background: 'var(--border-color)', margin: '0 4px' }} />

          <div className="logo-badge" style={{ width: 28, height: 28, fontSize: 15, borderRadius: 6 }}>F</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {project.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--cad-cyan)' }}>
              Fravit BIM Core v1.0 • {levels.length} Níveis
            </div>
          </div>
        </div>

        {/* Abas Centrais de Visualização */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-main)',
            padding: 4,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            gap: 4,
          }}
        >
          <button
            onClick={() => bimStore.setActiveView('plan')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeView === 'plan' ? 'var(--cad-blue)' : 'transparent',
              color: activeView === 'plan' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Square size={14} />
            <span>Planta 2D</span>
          </button>

          <button
            onClick={() => bimStore.setActiveView('3d')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeView === '3d' ? 'var(--cad-blue)' : 'transparent',
              color: activeView === '3d' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Box size={14} />
            <span>Vista 3D</span>
          </button>

          <button
            onClick={() => bimStore.setActiveView('section')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeView === 'section' ? 'var(--cad-blue)' : 'transparent',
              color: activeView === 'section' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Scissors size={14} />
            <span>Cortes (Sections)</span>
          </button>

          <button
            onClick={() => bimStore.setActiveView('sheet')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeView === 'sheet' ? 'var(--cad-blue)' : 'transparent',
              color: activeView === 'sheet' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Layers size={14} />
            <span>Prancha A1</span>
          </button>
        </div>

        {/* Ações Direitas */}
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => projectService.exportToFile(project, { ...project.bimData, elements })}
            title="Download .fravit"
          >
            <Download size={15} />
            <span>.fravit</span>
          </button>
          <button
            className="btn-primary"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={handleSave}
          >
            <Save size={15} />
            <span>Salvar</span>
          </button>
        </div>
      </header>

      {/* Workspace Completo do CAD */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Barra de Ferramentas CAD à Esquerda */}
        <CADToolbar />

        {/* Navegador de Projeto Lateral */}
        <aside
          style={{
            width: '230px',
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600 }}>
            Navegador de Projeto
          </div>

          <div style={{ padding: 12, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase', marginBottom: 8 }}>
                Plantas de Piso
              </div>
              {levels.map((lvl) => (
                <div
                  key={lvl.id}
                  onClick={() => bimStore.setActiveLevelId(lvl.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: activeLevelId === lvl.id ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                    border: `1px solid ${activeLevelId === lvl.id ? 'var(--cad-blue)' : 'transparent'}`,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: activeLevelId === lvl.id ? 600 : 400 }}>{lvl.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    +{lvl.elevation.toFixed(2)}m
                  </span>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase', marginBottom: 8 }}>
                Cortes
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', padding: '6px 10px' }}>
                Corte A-A (Transversal)
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase', marginBottom: 8 }}>
                Pranchas de Impressão
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={13} />
                <span>A101 - Folha Principal</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Viewport Central Three.js com Overlay Canvas */}
        <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <CADViewport onCursorMove={(pos) => setCursorPos(pos)} />
        </main>

        {/* Painel de Propriedades Paramétricas à Direita */}
        <PropertiesPanel />
      </div>

      {/* Barra de Status Inferior */}
      <CADStatusBar cursorPos={cursorPos} />
    </div>
  );
};

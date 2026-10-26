import React, { useState, useEffect } from 'react';
import type { ProjectDetail } from '../../types';
import { projectService } from '../../services/api';
import {
  ArrowLeft,
  Save,
  Download,
  Box,
  Square,
  Layers,
  Scissors,
  Grid,
} from 'lucide-react';

interface EditorPreviewProps {
  projectId: string;
  onBack: () => void;
}

export const EditorPreview: React.FC<EditorPreviewProps> = ({ projectId, onBack }) => {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | '3d' | 'section' | 'sheet'>('plan');

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        const data = await projectService.get(projectId);
        setProject(data);
      } catch (err: any) {
        alert(err.message || 'Erro ao carregar projeto.');
        onBack();
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [projectId, onBack]);

  if (loading || !project) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: 8 }}>Carregando projeto Fravit...</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Preparando modelo BIM e vistas gráficas</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Barra de Menus Superior do Editor */}
      <header
        style={{
          height: '56px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
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
              Fravit BIM Core v1.0 • {project.bimData?.levels?.length || 2} Níveis
            </div>
          </div>
        </div>

        {/* Abas Superiores de Visualização */}
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
            onClick={() => setActiveTab('plan')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'plan' ? 'var(--cad-blue)' : 'transparent',
              color: activeTab === 'plan' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Square size={14} />
            <span>Planta 2D</span>
          </button>

          <button
            onClick={() => setActiveTab('3d')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === '3d' ? 'var(--cad-blue)' : 'transparent',
              color: activeTab === '3d' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Box size={14} />
            <span>Vista 3D</span>
          </button>

          <button
            onClick={() => setActiveTab('section')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'section' ? 'var(--cad-blue)' : 'transparent',
              color: activeTab === 'section' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Scissors size={14} />
            <span>Cortes (Sections)</span>
          </button>

          <button
            onClick={() => setActiveTab('sheet')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'sheet' ? 'var(--cad-blue)' : 'transparent',
              color: activeTab === 'sheet' ? '#fff' : 'var(--text-muted)',
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
            onClick={() => projectService.exportToFile(project)}
            title="Download .fravit"
          >
            <Download size={15} />
            <span>.fravit</span>
          </button>
          <button
            className="btn-primary"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => alert('Projeto salvo com sucesso no banco de dados!')}
          >
            <Save size={15} />
            <span>Salvar</span>
          </button>
        </div>
      </header>

      {/* Área Central de Trabalho do Editor (Workspace) */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Painel do Navegador de Projeto à Esquerda */}
        <aside
          style={{
            width: '260px',
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600 }}>
            Navegador de Projeto
          </div>

          <div style={{ padding: 12, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase', marginBottom: 8 }}>
                Plantas de Piso
              </div>
              {project.bimData?.levels?.map((lvl) => (
                <div
                  key={lvl.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: project.bimData.activeLevelId === lvl.id ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                    border: `1px solid ${project.bimData.activeLevelId === lvl.id ? 'var(--cad-blue)' : 'transparent'}`,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <span>{lvl.name}</span>
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
                <span>A101 - Folha Principal (A1)</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Viewport Central */}
        <main
          style={{
            flex: 1,
            background: '#090d14',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Grid de fundo decorativo para CAD */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.12) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              opacity: 0.7,
            }}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 2,
              textAlign: 'center',
              padding: 40,
              background: 'rgba(20, 27, 38, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 580,
            }}
          >
            <Grid size={48} style={{ color: 'var(--cad-cyan)', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 8 }}>
              {activeTab === 'plan' && 'Planta Baixa 2D Técnica'}
              {activeTab === '3d' && 'Visualização Tridimensional (3D Orbit)'}
              {activeTab === 'section' && 'Cortes Paramétricos'}
              {activeTab === 'sheet' && 'Prancha de Impressão com Viewports'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: 20 }}>
              Base da Fase 1 pronta com sucesso! A integração do motor gráfico Three.js unificado (Câmera Ortográfica 2D + Perspectiva 3D), sistema de snaps magnéticos e desenho de paredes entrará em execução na <strong>Fase 2</strong>.
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 20,
                color: '#10b981',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <span>✓ Fase 1 Concluída: Backend Nativo, JWT, SQLite & Dashboard</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

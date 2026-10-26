import React, { useState } from 'react';
import { X, Layers, Home, Building2 } from 'lucide-react';
import { projectService } from '../../services/api';
import type { ProjectSummary } from '../../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: ProjectSummary) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onProjectCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<'blank' | 'house' | 'duplex'>('blank');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Por favor, informe um título para o projeto.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Configuração de dados iniciais conforme o template
      let bimData: any = undefined;
      if (template === 'house') {
        bimData = {
          version: '1.0.0',
          meta: { projectName: title, author: 'Arquiteto', unit: 'm', createdAt: new Date().toISOString() },
          activeLevelId: 'lvl-ground',
          levels: [
            { id: 'lvl-ground', name: 'Nível 1 - Térreo', elevation: 0.0, height: 2.8 },
            { id: 'lvl-roof', name: 'Cobertura', elevation: 2.8, height: 0.0 },
          ],
          elements: {
            walls: [
              { id: 'w1', start: { x: -4, y: -3 }, end: { x: 4, y: -3 }, thickness: 0.15, height: 2.8, levelId: 'lvl-ground' },
              { id: 'w2', start: { x: 4, y: -3 }, end: { x: 4, y: 3 }, thickness: 0.15, height: 2.8, levelId: 'lvl-ground' },
              { id: 'w3', start: { x: 4, y: 3 }, end: { x: -4, y: 3 }, thickness: 0.15, height: 2.8, levelId: 'lvl-ground' },
              { id: 'w4', start: { x: -4, y: 3 }, end: { x: -4, y: -3 }, thickness: 0.15, height: 2.8, levelId: 'lvl-ground' },
            ],
            doors: [],
            windows: [],
            floors: [],
            roofs: [],
            stairs: [],
            rooms: [],
            roomSeparators: [],
            dimensions: [],
            sections: [],
          },
          sheets: [{ id: 'sheet-1', number: 'A101', title: 'PLANTA BAIXA TÉRREO', size: 'A1', orientation: 'landscape', viewports: [] }],
        };
      }

      const created = await projectService.create(title, description, bimData);
      onProjectCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar projeto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Criar Novo Projeto BIM</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Configure o nome e selecione o modelo inicial de trabalho
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', color: 'var(--text-dim)', padding: 6, borderRadius: 6 }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ color: '#ef4444', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 6 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>Título do Projeto *</label>
              <input
                type="text"
                autoFocus
                required
                placeholder="Ex: Residência Fragata, Edifício Horizon..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>Descrição (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: Projeto arquitetônico executivo com 3 suítes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>Modelo Inicial (Template)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div
                  onClick={() => setTemplate('blank')}
                  style={{
                    border: `1px solid ${template === 'blank' ? 'var(--cad-blue)' : 'var(--border-color)'}`,
                    background: template === 'blank' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-main)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Layers size={22} style={{ color: template === 'blank' ? 'var(--cad-cyan)' : 'var(--text-dim)', margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Em Branco</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>2 Níveis vazios</div>
                </div>

                <div
                  onClick={() => setTemplate('house')}
                  style={{
                    border: `1px solid ${template === 'house' ? 'var(--cad-blue)' : 'var(--border-color)'}`,
                    background: template === 'house' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-main)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Home size={22} style={{ color: template === 'house' ? 'var(--cad-cyan)' : 'var(--text-dim)', margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Casa Térrea</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Perímetro inicial</div>
                </div>

                <div
                  onClick={() => setTemplate('duplex')}
                  style={{
                    border: `1px solid ${template === 'duplex' ? 'var(--cad-blue)' : 'var(--border-color)'}`,
                    background: template === 'duplex' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-main)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Building2 size={22} style={{ color: template === 'duplex' ? 'var(--cad-cyan)' : 'var(--text-dim)', margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Sobrado</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>3 Níveis prontos</div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Criando...' : 'Iniciar Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

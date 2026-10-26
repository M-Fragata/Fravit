import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { ProjectSummary } from '../../types';
import { projectService } from '../../services/api';
import { NewProjectModal } from './NewProjectModal';
import { AuthModal } from '../auth/AuthModal';
import { BlueprintThumbnail } from './BlueprintThumbnail';
import {
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Calendar,
  LogOut,
  User as UserIcon,
  FolderKanban,
  ExternalLink,
} from 'lucide-react';

interface DashboardProps {
  onOpenProject: (projectId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenProject }) => {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!user) {
        if (isMounted) {
          setProjects([]);
          setLoading(false);
        }
        return;
      }
      try {
        if (isMounted) setLoading(true);
        const list = await projectService.list();
        if (isMounted) setProjects(list);
      } catch (err) {
        console.error('Erro ao carregar projetos:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleCreateSuccess = (newProj: ProjectSummary) => {
    setProjects((prev) => [newProj, ...prev]);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (!confirm(`Deseja realmente excluir o projeto "${title}"?`)) return;

    try {
      await projectService.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir projeto.');
    }
  };

  const handleExport = async (e: React.MouseEvent, p: ProjectSummary) => {
    e.stopPropagation();
    try {
      const fullProj = await projectService.get(p.id);
      projectService.exportToFile(fullProj);
    } catch (err: any) {
      alert(err.message || 'Erro ao exportar arquivo .fravit');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const imported = await projectService.importFromFile(file);
      setProjects((prev) => [imported, ...prev]);
      alert(`Projeto "${imported.title}" importado com sucesso!`);
    } catch (err: any) {
      alert(err.message || 'Erro ao importar arquivo .fravit');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="dashboard-container">
      {/* Cabeçalho do Fravit */}
      <header className="dashboard-header">
        <div className="logo-container">
          <div className="logo-badge">F</div>
          <div>
            <div className="logo-title">Fravit</div>
            <div className="logo-subtitle">BIM & Technical CAD</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Input oculto para importação de arquivo .fravit */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".fravit,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            className="btn-secondary"
            onClick={() => {
              if (!user) {
                setIsAuthModalOpen(true);
              } else {
                fileInputRef.current?.click();
              }
            }}
          >
            <Upload size={16} />
            <span>Importar .fravit</span>
          </button>

          {user ? (
            <div className="flex items-center gap-3" style={{ marginLeft: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  background: 'var(--bg-main)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                }}
              >
                <UserIcon size={14} style={{ color: 'var(--cad-cyan)' }} />
                <span>{user.name}</span>
              </div>
              <button
                className="btn-secondary"
                style={{ padding: '8px 12px' }}
                title="Sair da conta"
                onClick={logout}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={() => setIsAuthModalOpen(true)}>
              <UserIcon size={16} />
              <span>Entrar / Cadastrar</span>
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Principal do Dashboard */}
      <main className="dashboard-main">
        <div className="dashboard-topbar">
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-brand)', marginBottom: 4 }}>
              Painel de Projetos
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Crie, gerencie e versione seus desenhos técnicos e modelos BIM
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="search-bar">
              <Search size={18} style={{ color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Pesquisar projetos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Grid de Projetos */}
        <div className="projects-grid">
          {/* Card 1: Botão '+' para Criar Novo Projeto */}
          <div
            className="card-new-project"
            onClick={() => {
              if (!user) {
                setIsAuthModalOpen(true);
              } else {
                setIsNewModalOpen(true);
              }
            }}
          >
            <div className="plus-icon-circle">
              <Plus size={30} strokeWidth={2.5} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
              Novo Projeto
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: 210 }}>
              Iniciar planta baixa 2D com visualização 3D paramétrica
            </p>
          </div>

          {/* Cards dos Projetos Existentes */}
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => onOpenProject(project.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Miniatura Gráfica Técnica */}
              <div className="project-thumbnail">
                {project.thumbnail ? (
                  <img src={project.thumbnail} alt={project.title} />
                ) : (
                  <BlueprintThumbnail title={project.title} />
                )}
                <div className="thumbnail-overlay-badge">BIM 2D/3D</div>
              </div>

              {/* Informações do Projeto */}
              <div className="project-content">
                <div>
                  <h3 className="project-title" title={project.title}>
                    {project.title}
                  </h3>
                  {project.description && (
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-dim)',
                        marginBottom: 10,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {project.description}
                    </p>
                  )}
                  <div className="project-date">
                    <Calendar size={13} />
                    <span>
                      Modificado em {new Date(project.updatedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Rodapé com Ações */}
                <div className="project-card-footer">
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--cad-cyan)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Abrir <ExternalLink size={13} />
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleExport(e, project)}
                      title="Exportar arquivo .fravit (JSON)"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                        padding: 6,
                        borderRadius: 6,
                      }}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, project.id, project.title)}
                      title="Excluir projeto"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        padding: 6,
                        borderRadius: 6,
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Estado sem projetos ou sem login */}
        {!loading && projects.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: 'rgba(20, 27, 38, 0.3)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              marginTop: 32,
            }}
          >
            <FolderKanban size={48} style={{ color: 'var(--text-dim)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 8 }}>
              {!user ? 'Faça login para salvar seus projetos' : 'Nenhum projeto encontrado'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: 440, margin: '0 auto 20px' }}>
              {!user
                ? 'Entre na sua conta ou cadastre-se para criar novos projetos com sincronização em nuvem e exportação de pranchas.'
                : 'Clique no card com o ícone "+" acima para começar seu primeiro desenho arquitetônico.'}
            </p>
            {!user && (
              <button className="btn-primary" style={{ margin: '0 auto' }} onClick={() => setIsAuthModalOpen(true)}>
                Criar Conta ou Fazer Login
              </button>
            )}
          </div>
        )}
      </main>

      {/* Modais */}
      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onProjectCreated={handleCreateSuccess}
      />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

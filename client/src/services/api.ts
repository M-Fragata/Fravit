import type { ProjectSummary, ProjectDetail, User, BIMData } from '../types';

const TOKEN_KEY = 'fravit_token';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
};

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Ocorreu um erro na requisição.');
  }

  return data;
}

// -------------------------------------------------------------
// Serviços de Autenticação
// -------------------------------------------------------------
export const authService = {
  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await apiRequest<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    authStorage.setToken(res.token);
    return res;
  },

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await apiRequest<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    authStorage.setToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return apiRequest<{ user: User }>('/api/auth/me');
  },

  logout() {
    authStorage.clearToken();
  },
};

// -------------------------------------------------------------
// Serviços de Projetos
// -------------------------------------------------------------
export const projectService = {
  async list(): Promise<ProjectSummary[]> {
    const res = await apiRequest<{ projects: ProjectSummary[] }>('/api/projects');
    return res.projects;
  },

  async get(id: string): Promise<ProjectDetail> {
    const res = await apiRequest<{ project: ProjectDetail }>(`/api/projects/${id}`);
    return res.project;
  },

  async create(title: string, description: string = '', bimData?: BIMData): Promise<ProjectSummary> {
    const res = await apiRequest<{ project: ProjectSummary }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title, description, bimData }),
    });
    return res.project;
  },

  async update(id: string, updates: { title?: string; description?: string; bimData?: any; thumbnail?: string }): Promise<void> {
    await apiRequest(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string): Promise<void> {
    await apiRequest(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  },

  // Exportar projeto como arquivo local .fravit (JSON)
  exportToFile(project: ProjectDetail | ProjectSummary, bimData?: BIMData) {
    const exportData = {
      app: 'Fravit',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        bimData: bimData || (project as ProjectDetail).bimData || {},
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.fravit`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Importar arquivo .fravit local para criar no sistema
  async importFromFile(file: File): Promise<ProjectSummary> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          const projectTitle = parsed.project?.title || file.name.replace('.fravit', '');
          const projectDesc = parsed.project?.description || 'Projeto importado de arquivo .fravit';
          const bimData = parsed.project?.bimData;

          const created = await projectService.create(projectTitle, projectDesc, bimData);
          resolve(created);
        } catch {
          reject(new Error('Arquivo .fravit inválido ou corrompido.'));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
      reader.readAsText(file);
    });
  },
};

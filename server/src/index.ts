import http from 'node:http';
import { initDatabase } from './db.ts';
import { verifyJWT } from './auth.ts';
import { handleRegister, handleLogin, handleMe } from './controllers/authController.ts';
import {
  handleListProjects,
  handleGetProject,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
} from './controllers/projectController.ts';

// Inicializar banco de dados nativo
initDatabase();

const PORT = Number(process.env.PORT) || 3001;

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: http.ServerResponse, status: number, data: any) {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Leitura de corpo de requisições JSON
async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Limite de segurança de 50MB
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Extração de usuário autenticado via Bearer Token
function getAuthUser(req: http.IncomingMessage) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyJWT(token);
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  try {
    // -------------------------------------------------------------
    // Rotas Públicas de Autenticação
    // -------------------------------------------------------------
    if (method === 'POST' && pathname === '/api/auth/register') {
      const body = await parseBody(req);
      const result = handleRegister(body);
      return sendJson(res, result.status, result.data);
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await parseBody(req);
      const result = handleLogin(body);
      return sendJson(res, result.status, result.data);
    }

    // -------------------------------------------------------------
    // Middleware de Proteção por Token JWT
    // -------------------------------------------------------------
    const user = getAuthUser(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Não autorizado. Faça login para continuar.' });
    }

    if (method === 'GET' && pathname === '/api/auth/me') {
      const result = handleMe(user);
      return sendJson(res, result.status, result.data);
    }

    // -------------------------------------------------------------
    // Rotas de Projetos (CRUD)
    // -------------------------------------------------------------
    if (method === 'GET' && pathname === '/api/projects') {
      const result = handleListProjects(user.id);
      return sendJson(res, result.status, result.data);
    }

    if (method === 'POST' && pathname === '/api/projects') {
      const body = await parseBody(req);
      const result = handleCreateProject(body, user.id);
      return sendJson(res, result.status, result.data);
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)$/);
    if (projectMatch) {
      const projectId = projectMatch[1];

      if (method === 'GET') {
        const result = handleGetProject(projectId, user.id);
        return sendJson(res, result.status, result.data);
      }

      if (method === 'PUT') {
        const body = await parseBody(req);
        const result = handleUpdateProject(projectId, body, user.id);
        return sendJson(res, result.status, result.data);
      }

      if (method === 'DELETE') {
        const result = handleDeleteProject(projectId, user.id);
        return sendJson(res, result.status, result.data);
      }
    }

    // Rota não encontrada
    return sendJson(res, 404, { error: `Rota não encontrada: ${method} ${pathname}` });
  } catch (err: any) {
    console.error('[SERVER ERROR]', err);
    return sendJson(res, 500, { error: err.message || 'Erro interno do servidor.' });
  }
});

server.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`  🚀 Fravit Backend API rodando em http://localhost:${PORT}`);
  console.log(`  📦 100% Nativo Node v24 (SQLite + Crypto + HTTP)`);
  console.log(`=================================================\n`);
});

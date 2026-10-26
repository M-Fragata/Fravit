import crypto from 'node:crypto';
import { db } from '../db.ts';

function getDefaultBimData(title: string) {
  return JSON.stringify({
    version: '1.0.0',
    meta: {
      projectName: title,
      author: 'Arquiteto',
      unit: 'm',
      createdAt: new Date().toISOString(),
    },
    activeLevelId: 'lvl-ground',
    levels: [
      { id: 'lvl-ground', name: 'Nível 1 - Térreo', elevation: 0.0, height: 2.8 },
      { id: 'lvl-upper', name: 'Nível 2 - Superior', elevation: 2.8, height: 2.8 },
      { id: 'lvl-roof', name: 'Cobertura', elevation: 5.6, height: 0.0 },
    ],
    elements: {
      walls: [],
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
    sheets: [
      {
        id: 'sheet-1',
        number: 'A101',
        title: 'PLANTA BAIXA E CORTES',
        size: 'A1',
        orientation: 'landscape',
        viewports: [],
      },
    ],
  });
}

export function handleListProjects(userId: string) {
  const projects = db
    .prepare(
      `SELECT id, title, description, thumbnail, createdAt, updatedAt 
       FROM projects 
       WHERE userId = ? 
       ORDER BY updatedAt DESC`
    )
    .all(userId);

  return {
    status: 200,
    data: { projects },
  };
}

export function handleGetProject(id: string, userId: string) {
  const project = db
    .prepare('SELECT * FROM projects WHERE id = ? AND userId = ?')
    .get(id, userId) as any;

  if (!project) {
    return { status: 404, data: { error: 'Projeto não encontrado.' } };
  }

  return {
    status: 200,
    data: {
      project: {
        ...project,
        bimData: JSON.parse(project.bimData),
      },
    },
  };
}

export function handleCreateProject(body: any, userId: string) {
  const { title, description = '', bimData, thumbnail = '' } = body || {};

  if (!title || !title.trim()) {
    return { status: 400, data: { error: 'O título do projeto é obrigatório.' } };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const serializedBimData = bimData ? (typeof bimData === 'string' ? bimData : JSON.stringify(bimData)) : getDefaultBimData(title.trim());

  db.prepare(`
    INSERT INTO projects (id, title, description, bimData, thumbnail, userId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title.trim(), description.trim(), serializedBimData, thumbnail, userId, now, now);

  return {
    status: 201,
    data: {
      message: 'Projeto criado com sucesso!',
      project: {
        id,
        title: title.trim(),
        description: description.trim(),
        thumbnail,
        createdAt: now,
        updatedAt: now,
      },
    },
  };
}

export function handleUpdateProject(id: string, body: any, userId: string) {
  const project = db
    .prepare('SELECT id FROM projects WHERE id = ? AND userId = ?')
    .get(id, userId);

  if (!project) {
    return { status: 404, data: { error: 'Projeto não encontrado.' } };
  }

  const { title, description, bimData, thumbnail } = body || {};
  const now = new Date().toISOString();

  const updates: string[] = ['updatedAt = ?'];
  const params: any[] = [now];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description.trim());
  }
  if (bimData !== undefined) {
    updates.push('bimData = ?');
    params.push(typeof bimData === 'string' ? bimData : JSON.stringify(bimData));
  }
  if (thumbnail !== undefined) {
    updates.push('thumbnail = ?');
    params.push(thumbnail);
  }

  params.push(id, userId);

  db.prepare(`
    UPDATE projects 
    SET ${updates.join(', ')} 
    WHERE id = ? AND userId = ?
  `).run(...params);

  return {
    status: 200,
    data: { message: 'Projeto atualizado com sucesso!' },
  };
}

export function handleDeleteProject(id: string, userId: string) {
  const result = db
    .prepare('DELETE FROM projects WHERE id = ? AND userId = ?')
    .run(id, userId);

  if (result.changes === 0) {
    return { status: 404, data: { error: 'Projeto não encontrado.' } };
  }

  return {
    status: 200,
    data: { message: 'Projeto excluído com sucesso!' },
  };
}

import crypto from 'node:crypto';
import { db } from '../db.ts';
import { hashPassword, verifyPassword, signJWT } from '../auth.ts';

export function handleRegister(body: any) {
  const { name, email, password } = body || {};

  if (!name || !email || !password) {
    return { status: 400, data: { error: 'Nome, e-mail e senha são obrigatórios.' } };
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return { status: 409, data: { error: 'Já existe um usuário cadastrado com este e-mail.' } };
  }

  const id = crypto.randomUUID();
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, name, email, passwordHash, salt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), email.toLowerCase().trim(), hash, salt, now);

  const token = signJWT({ id, name, email });

  return {
    status: 201,
    data: {
      message: 'Usuário cadastrado com sucesso!',
      user: { id, name, email },
      token,
    },
  };
}

export function handleLogin(body: any) {
  const { email, password } = body || {};

  if (!email || !password) {
    return { status: 400, data: { error: 'E-mail e senha são obrigatórios.' } };
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;
  if (!user) {
    return { status: 401, data: { error: 'E-mail ou senha inválidos.' } };
  }

  const valid = verifyPassword(password, user.passwordHash, user.salt);
  if (!valid) {
    return { status: 401, data: { error: 'E-mail ou senha inválidos.' } };
  }

  const token = signJWT({ id: user.id, name: user.name, email: user.email });

  return {
    status: 200,
    data: {
      message: 'Login realizado com sucesso!',
      user: { id: user.id, name: user.name, email: user.email },
      token,
    },
  };
}

export function handleMe(user: any) {
  return {
    status: 200,
    data: { user },
  };
}

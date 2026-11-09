import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import { ChatMessage, Conversation, MessageAttachment, ResponseMode, Role } from './types';

// Declare global client for hot reloading in development
declare global {
  // eslint-disable-next-line no-var
  var __libsql_chat_client__: Client | undefined;
  // eslint-disable-next-line no-var
  var __libsql_init_promise__: Promise<void> | undefined;
}

function resolveDbUrl(): string {
  // 1. If remote Turso / libSQL URL is provided, use it directly (ideal for Vercel)
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }

  // 2. If running on Vercel serverless without Turso, use /tmp (the only writable directory on Vercel)
  if (process.env.VERCEL) {
    return 'file:/tmp/chat.db';
  }

  // 3. Local development or Docker: use ./data/chat.db
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      // Ignore if read-only
    }
  }
  return `file:${path.join(dataDir, 'chat.db')}`;
}

export function getClient(): Client {
  if (global.__libsql_chat_client__) {
    return global.__libsql_chat_client__;
  }

  const url = resolveDbUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient({
    url,
    authToken,
  });

  if (process.env.NODE_ENV !== 'production') {
    global.__libsql_chat_client__ = client;
  }

  return client;
}

const client = getClient();

export async function initDb(): Promise<void> {
  if (global.__libsql_init_promise__) {
    return global.__libsql_init_promise__;
  }

  const initAction = async () => {
    await client.batch([
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'answer_only',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attachments TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS rate_limits (
        ip TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 1,
        first_attempt_at INTEGER NOT NULL,
        last_attempt_at INTEGER NOT NULL,
        blocked_until INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)`,
    ]);
  };

  global.__libsql_init_promise__ = initAction();
  return global.__libsql_init_promise__;
}

export async function listConversations(): Promise<Conversation[]> {
  await initDb();
  const rs = await client.execute(`
    SELECT c.id, c.title, c.mode, c.created_at as createdAt, c.updated_at as updatedAt,
           COUNT(m.id) as messageCount
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `);

  return rs.rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    mode: String(r.mode) as ResponseMode,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
    messageCount: Number(r.messageCount || 0),
  }));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  await initDb();
  const rs = await client.execute({
    sql: `SELECT id, title, mode, created_at as createdAt, updated_at as updatedAt
          FROM conversations
          WHERE id = ?`,
    args: [id],
  });

  if (rs.rows.length === 0) return null;
  const r = rs.rows[0];

  return {
    id: String(r.id),
    title: String(r.title),
    mode: String(r.mode) as ResponseMode,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  };
}

export async function createConversation(
  id: string,
  title: string,
  mode: ResponseMode = 'answer_only'
): Promise<Conversation> {
  await initDb();
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO conversations (id, title, mode, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, title, mode, now, now],
  });

  return {
    id,
    title,
    mode,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  await initDb();
  await client.execute({
    sql: `UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`,
    args: [title, Date.now(), id],
  });
}

export async function updateConversationMode(id: string, mode: ResponseMode): Promise<void> {
  await initDb();
  await client.execute({
    sql: `UPDATE conversations SET mode = ?, updated_at = ? WHERE id = ?`,
    args: [mode, Date.now(), id],
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await initDb();
  await client.batch([
    {
      sql: `DELETE FROM messages WHERE conversation_id = ?`,
      args: [id],
    },
    {
      sql: `DELETE FROM conversations WHERE id = ?`,
      args: [id],
    },
  ]);
}

export async function getMessages(conversationId: string, limit = 50): Promise<ChatMessage[]> {
  await initDb();
  const rs = await client.execute({
    sql: `SELECT id, conversation_id as conversationId, role, content, attachments, created_at as createdAt
          FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at ASC
          LIMIT ?`,
    args: [conversationId, limit],
  });

  return rs.rows.map((r) => ({
    id: String(r.id),
    conversationId: String(r.conversationId),
    role: String(r.role) as Role,
    content: String(r.content),
    attachments: r.attachments ? (JSON.parse(String(r.attachments)) as MessageAttachment[]) : undefined,
    createdAt: Number(r.createdAt),
  }));
}

export async function saveMessage(msg: {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  attachments?: MessageAttachment[];
  createdAt?: number;
}): Promise<ChatMessage> {
  await initDb();
  const createdAt = msg.createdAt || Date.now();
  const attachmentsJson = msg.attachments && msg.attachments.length > 0 ? JSON.stringify(msg.attachments) : null;

  await client.batch([
    {
      sql: `INSERT INTO messages (id, conversation_id, role, content, attachments, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [msg.id, msg.conversationId, msg.role, msg.content, attachmentsJson, createdAt],
    },
    {
      sql: `UPDATE conversations SET updated_at = ? WHERE id = ?`,
      args: [createdAt, msg.conversationId],
    },
  ]);

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    role: msg.role,
    content: msg.content,
    attachments: msg.attachments,
    createdAt,
  };
}

// Rate Limiting helpers
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes block

export async function checkRateLimit(ip: string): Promise<{ isBlocked: boolean; remainingSeconds: number }> {
  await initDb();
  const rs = await client.execute({
    sql: `SELECT * FROM rate_limits WHERE ip = ?`,
    args: [ip],
  });

  if (rs.rows.length === 0) {
    return { isBlocked: false, remainingSeconds: 0 };
  }

  const record = rs.rows[0];
  const now = Date.now();
  const blockedUntil = Number(record.blocked_until);

  if (blockedUntil > now) {
    const remaining = Math.ceil((blockedUntil - now) / 1000);
    return { isBlocked: true, remainingSeconds: remaining };
  }

  return { isBlocked: false, remainingSeconds: 0 };
}

export async function recordFailedAttempt(ip: string): Promise<{ isBlocked: boolean; remainingSeconds: number }> {
  await initDb();
  const now = Date.now();
  const rs = await client.execute({
    sql: `SELECT * FROM rate_limits WHERE ip = ?`,
    args: [ip],
  });

  if (rs.rows.length === 0) {
    await client.execute({
      sql: `INSERT INTO rate_limits (ip, attempts, first_attempt_at, last_attempt_at, blocked_until)
            VALUES (?, 1, ?, ?, 0)`,
      args: [ip, now, now],
    });
    return { isBlocked: false, remainingSeconds: 0 };
  }

  const record = rs.rows[0];
  const firstAttemptAt = Number(record.first_attempt_at);
  const attempts = Number(record.attempts);

  if (now - firstAttemptAt > WINDOW_MS) {
    await client.execute({
      sql: `UPDATE rate_limits
            SET attempts = 1, first_attempt_at = ?, last_attempt_at = ?, blocked_until = 0
            WHERE ip = ?`,
      args: [now, now, ip],
    });
    return { isBlocked: false, remainingSeconds: 0 };
  }

  const newAttempts = attempts + 1;
  let blockedUntil = 0;
  let isBlocked = false;
  let remainingSeconds = 0;

  if (newAttempts >= MAX_ATTEMPTS) {
    blockedUntil = now + BLOCK_DURATION_MS;
    isBlocked = true;
    remainingSeconds = Math.ceil(BLOCK_DURATION_MS / 1000);
  }

  await client.execute({
    sql: `UPDATE rate_limits
          SET attempts = ?, last_attempt_at = ?, blocked_until = ?
          WHERE ip = ?`,
    args: [newAttempts, now, blockedUntil, ip],
  });

  return { isBlocked, remainingSeconds };
}

export async function resetRateLimit(ip: string): Promise<void> {
  await initDb();
  await client.execute({
    sql: `DELETE FROM rate_limits WHERE ip = ?`,
    args: [ip],
  });
}

export async function getDatabaseHealth(): Promise<{ status: 'ok' | 'error'; messageCount: number; conversationCount: number }> {
  try {
    await initDb();
    const convRs = await client.execute('SELECT COUNT(*) as count FROM conversations');
    const msgRs = await client.execute('SELECT COUNT(*) as count FROM messages');
    return {
      status: 'ok',
      conversationCount: Number(convRs.rows[0]?.count || 0),
      messageCount: Number(msgRs.rows[0]?.count || 0),
    };
  } catch {
    return {
      status: 'error',
      conversationCount: 0,
      messageCount: 0,
    };
  }
}

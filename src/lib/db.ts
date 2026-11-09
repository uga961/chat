import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ChatMessage, Conversation, MessageAttachment, ResponseMode, Role } from './types';

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'chat.db');

// Initialize database with singleton pattern for Next.js hot-reloading
declare global {
  // eslint-disable-next-line no-var
  var __chat_db__: Database.Database | undefined;
}

function getDatabase(): Database.Database {
  if (global.__chat_db__) {
    return global.__chat_db__;
  }

  const db = new Database(DB_PATH);
  
  // Pragmas for performance and data integrity
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'answer_only',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      ip TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 1,
      first_attempt_at INTEGER NOT NULL,
      last_attempt_at INTEGER NOT NULL,
      blocked_until INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
  `);

  if (process.env.NODE_ENV !== 'production') {
    global.__chat_db__ = db;
  }

  return db;
}

const db = getDatabase();

export function listConversations(): Conversation[] {
  const stmt = db.prepare(`
    SELECT c.id, c.title, c.mode, c.created_at as createdAt, c.updated_at as updatedAt,
           COUNT(m.id) as messageCount
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `);
  
  const rows = stmt.all() as Array<{
    id: string;
    title: string;
    mode: ResponseMode;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
  }>;

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    mode: r.mode,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    messageCount: Number(r.messageCount),
  }));
}

export function getConversation(id: string): Conversation | null {
  const stmt = db.prepare(`
    SELECT id, title, mode, created_at as createdAt, updated_at as updatedAt
    FROM conversations
    WHERE id = ?
  `);
  const row = stmt.get(id) as {
    id: string;
    title: string;
    mode: ResponseMode;
    createdAt: number;
    updatedAt: number;
  } | undefined;

  return row || null;
}

export function createConversation(id: string, title: string, mode: ResponseMode = 'answer_only'): Conversation {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO conversations (id, title, mode, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, title, mode, now, now);

  return {
    id,
    title,
    mode,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
}

export function updateConversationTitle(id: string, title: string): void {
  const stmt = db.prepare(`
    UPDATE conversations
    SET title = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(title, Date.now(), id);
}

export function updateConversationMode(id: string, mode: ResponseMode): void {
  const stmt = db.prepare(`
    UPDATE conversations
    SET mode = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(mode, Date.now(), id);
}

export function deleteConversation(id: string): void {
  const stmt = db.prepare(`DELETE FROM conversations WHERE id = ?`);
  stmt.run(id);
}

export function getMessages(conversationId: string, limit = 50): ChatMessage[] {
  const stmt = db.prepare(`
    SELECT id, conversation_id as conversationId, role, content, attachments, created_at as createdAt
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `);

  const rows = stmt.all(conversationId, limit) as Array<{
    id: string;
    conversationId: string;
    role: Role;
    content: string;
    attachments: string | null;
    createdAt: number;
  }>;

  return rows.map(r => ({
    id: r.id,
    conversationId: r.conversationId,
    role: r.role,
    content: r.content,
    attachments: r.attachments ? (JSON.parse(r.attachments) as MessageAttachment[]) : undefined,
    createdAt: r.createdAt,
  }));
}

export function saveMessage(msg: {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  attachments?: MessageAttachment[];
  createdAt?: number;
}): ChatMessage {
  const createdAt = msg.createdAt || Date.now();
  const attachmentsJson = msg.attachments && msg.attachments.length > 0 ? JSON.stringify(msg.attachments) : null;

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, attachments, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const updateConv = db.prepare(`
    UPDATE conversations
    SET updated_at = ?
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    insertMsg.run(msg.id, msg.conversationId, msg.role, msg.content, attachmentsJson, createdAt);
    updateConv.run(createdAt, msg.conversationId);
  });

  tx();

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    role: msg.role,
    content: msg.content,
    attachments: msg.attachments,
    createdAt,
  };
}

// Rate Limiting helpers for authentication
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes block

export function checkRateLimit(ip: string): { isBlocked: boolean; remainingSeconds: number } {
  const now = Date.now();
  const stmt = db.prepare(`SELECT * FROM rate_limits WHERE ip = ?`);
  const record = stmt.get(ip) as {
    attempts: number;
    first_attempt_at: number;
    last_attempt_at: number;
    blocked_until: number;
  } | undefined;

  if (!record) {
    return { isBlocked: false, remainingSeconds: 0 };
  }

  if (record.blocked_until > now) {
    const remaining = Math.ceil((record.blocked_until - now) / 1000);
    return { isBlocked: true, remainingSeconds: remaining };
  }

  return { isBlocked: false, remainingSeconds: 0 };
}

export function recordFailedAttempt(ip: string): { isBlocked: boolean; remainingSeconds: number } {
  const now = Date.now();
  const getStmt = db.prepare(`SELECT * FROM rate_limits WHERE ip = ?`);
  const record = getStmt.get(ip) as {
    attempts: number;
    first_attempt_at: number;
    last_attempt_at: number;
    blocked_until: number;
  } | undefined;

  if (!record) {
    const insertStmt = db.prepare(`
      INSERT INTO rate_limits (ip, attempts, first_attempt_at, last_attempt_at, blocked_until)
      VALUES (?, 1, ?, ?, 0)
    `);
    insertStmt.run(ip, now, now);
    return { isBlocked: false, remainingSeconds: 0 };
  }

  // If outside sliding window, reset window
  if (now - record.first_attempt_at > WINDOW_MS) {
    const resetStmt = db.prepare(`
      UPDATE rate_limits
      SET attempts = 1, first_attempt_at = ?, last_attempt_at = ?, blocked_until = 0
      WHERE ip = ?
    `);
    resetStmt.run(now, now, ip);
    return { isBlocked: false, remainingSeconds: 0 };
  }

  const newAttempts = record.attempts + 1;
  let blockedUntil = 0;
  let isBlocked = false;
  let remainingSeconds = 0;

  if (newAttempts >= MAX_ATTEMPTS) {
    blockedUntil = now + BLOCK_DURATION_MS;
    isBlocked = true;
    remainingSeconds = Math.ceil(BLOCK_DURATION_MS / 1000);
  }

  const updateStmt = db.prepare(`
    UPDATE rate_limits
    SET attempts = ?, last_attempt_at = ?, blocked_until = ?
    WHERE ip = ?
  `);
  updateStmt.run(newAttempts, now, blockedUntil, ip);

  return { isBlocked, remainingSeconds };
}

export function resetRateLimit(ip: string): void {
  const stmt = db.prepare(`DELETE FROM rate_limits WHERE ip = ?`);
  stmt.run(ip);
}

export function getDatabaseHealth(): { status: 'ok' | 'error'; messageCount: number; conversationCount: number } {
  try {
    const convCount = (db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }).count;
    const msgCount = (db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }).count;
    return {
      status: 'ok',
      conversationCount: Number(convCount),
      messageCount: Number(msgCount),
    };
  } catch {
    return {
      status: 'error',
      conversationCount: 0,
      messageCount: 0,
    };
  }
}

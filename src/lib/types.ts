export type ResponseMode = 'answer_only' | 'short' | 'detailed';

export type Role = 'user' | 'assistant' | 'system';

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // Base64 encoded payload
  size?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  attachments?: MessageAttachment[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  mode: ResponseMode;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

export interface ChatRequestPayload {
  conversationId?: string;
  message: string;
  attachments?: MessageAttachment[];
  mode?: ResponseMode;
}

export interface AuthSession {
  authenticated: boolean;
  issuedAt: number;
}

import { GoogleGenAI } from '@google/genai';
import { ChatMessage, MessageAttachment, ResponseMode } from './types';
import { getSystemPrompt } from './prompts';

/**
 * Returns the configured Gemini model name.
 * Defaults to 'gemini-3.5-flash' for the best balance of deep technical reasoning,
 * complete/thorough answers, and fast 5-7s response times without stalling.
 */
export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
}

/**
 * Validates and initializes the GoogleGenAI client singleton.
 */
function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please add it to your environment variables.');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Strips data URI prefixes if present, leaving raw base64.
 */
export function cleanBase64(data: string): string {
  const commaIndex = data.indexOf(',');
  if (commaIndex !== -1 && data.slice(0, commaIndex).includes('base64')) {
    return data.slice(commaIndex + 1);
  }
  return data;
}

/**
 * Normalizes attachments into Gemini inlineData format.
 */
function formatAttachments(attachments?: MessageAttachment[]) {
  if (!attachments || attachments.length === 0) return [];

  return attachments.map(att => ({
    inlineData: {
      mimeType: att.mimeType || 'image/jpeg',
      data: cleanBase64(att.data),
    },
  }));
}

/**
 * Prepares the conversation history window for Gemini.
 * Keeps the most recent 8 messages to provide deep context retention
 * while avoiding excessive token bloat.
 */
export function formatConversationContents(
  history: ChatMessage[],
  newMessage: string,
  newAttachments?: MessageAttachment[]
) {
  const recentHistory = history.slice(-8);

  const contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  }> = [];

  for (const msg of recentHistory) {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: cleanBase64(att.data),
          },
        });
      }
    }

    if (msg.content) {
      parts.push({ text: msg.content });
    }

    if (parts.length > 0) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      });
    }
  }

  // Current user turn
  const currentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  const currentImageParts = formatAttachments(newAttachments);
  currentParts.push(...currentImageParts);

  if (newMessage && newMessage.trim().length > 0) {
    currentParts.push({ text: newMessage });
  } else if (currentImageParts.length > 0) {
    currentParts.push({
      text: 'Analyze the attached image(s) thoroughly. Extract the question, code, problem, tables, or multiple-choice options, and provide the complete, correct answer.',
    });
  }

  contents.push({
    role: 'user',
    parts: currentParts,
  });

  return contents;
}

export interface StreamOptions {
  history?: ChatMessage[];
  message: string;
  attachments?: MessageAttachment[];
  mode?: ResponseMode;
}

/**
 * Streams Gemini response chunks with high-precision settings and automatic retry.
 */
export async function* streamGeminiResponse({
  history = [],
  message,
  attachments = [],
  mode = 'answer_only',
}: StreamOptions): AsyncGenerator<string, void, unknown> {
  const ai = getGenAIClient();
  const modelName = getGeminiModelName();
  const systemInstruction = getSystemPrompt(mode);
  const contents = formatConversationContents(history, message, attachments);

  // Full generation configuration to ensure complete, thorough, un-truncated answers
  const config: Record<string, unknown> = {
    systemInstruction,
    temperature: 0.2, // Optimal temperature for technical precision, syntax accuracy, and correctness
    topP: 0.95,
    maxOutputTokens: 8192, // Generous limit to ensure code and explanations are never truncated
  };

  const maxRetries = 2;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents,
        config,
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
      return;
    } catch (error: unknown) {
      attempt++;
      const err = error as { status?: number; message?: string };
      const isTransient =
        err.status === 429 ||
        err.status === 503 ||
        (err.message && /rate limit|overloaded|timeout|high demand|unavailable/i.test(err.message));

      if (attempt <= maxRetries && isTransient) {
        const backoffMs = attempt * 2000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      // Re-throw formatted error
      if (err.status === 401 || (err.message && /api key/i.test(err.message))) {
        throw new Error('Invalid Gemini API Key or authentication failed.');
      }
      if (err.status === 429) {
        throw new Error('Gemini API rate limit exceeded. Please wait a moment before trying again.');
      }
      if (err.status === 503) {
        throw new Error('Gemini model is currently experiencing high demand. Please retry in a few seconds.');
      }
      throw new Error(err.message || 'An unexpected error occurred while communicating with Gemini.');
    }
  }
}

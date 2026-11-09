import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getConversation,
  createConversation,
  getMessages,
  saveMessage,
  updateConversationTitle,
} from '@/lib/db';
import { streamGeminiResponse } from '@/lib/gemini';
import { MessageAttachment, ResponseMode } from '@/lib/types';

// Helper to generate a concise title from the user prompt
function generateTitleFromPrompt(text: string, hasImages: boolean): string {
  if (!text || text.trim().length === 0) {
    return hasImages ? 'Image Analysis' : 'New Technical Chat';
  }
  const clean = text.replace(/[\r\n]+/g, ' ').trim();
  const words = clean.split(' ').slice(0, 7).join(' ');
  return words.length > 50 ? `${words.slice(0, 47)}...` : words;
}

export async function POST(request: NextRequest) {
  try {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const {
      message = '',
      attachments = [] as MessageAttachment[],
      mode = 'answer_only' as ResponseMode,
    } = payload;

    let conversationId = payload.conversationId;

    if (!message.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Cannot send an empty message without attachments.' },
        { status: 400 }
      );
    }

    // Verify or initialize conversation
    let conversation = conversationId ? getConversation(conversationId) : null;
    let isNewConversation = false;

    if (!conversation) {
      conversationId = crypto.randomUUID();
      const title = generateTitleFromPrompt(message, attachments.length > 0);
      conversation = createConversation(conversationId, title, mode);
      isNewConversation = true;
    } else if (conversation.title === 'New Technical Chat' && message.trim()) {
      // Auto-update default placeholder title
      updateConversationTitle(conversationId, generateTitleFromPrompt(message, attachments.length > 0));
    }

    // Retrieve prior conversation history for context
    const history = getMessages(conversationId, 10);

    // Persist user message to SQLite
    const userMessageId = crypto.randomUUID();
    const userMessage = saveMessage({
      id: userMessageId,
      conversationId,
      role: 'user',
      content: message,
      attachments,
      createdAt: Date.now(),
    });

    // Create assistant message placeholder ID
    const assistantMessageId = crypto.randomUUID();

    // Prepare SSE Streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial metadata event (conversationId, userMessage, assistantMessageId)
        const initData = JSON.stringify({
          type: 'start',
          conversationId,
          isNewConversation,
          userMessage,
          assistantMessageId,
          mode,
        });
        controller.enqueue(encoder.encode(`event: start\ndata: ${initData}\n\n`));

        let fullAssistantResponse = '';

        try {
          const geminiStream = streamGeminiResponse({
            history,
            message,
            attachments,
            mode,
          });

          for await (const chunk of geminiStream) {
            fullAssistantResponse += chunk;
            const chunkData = JSON.stringify({
              type: 'chunk',
              text: chunk,
            });
            controller.enqueue(encoder.encode(`event: chunk\ndata: ${chunkData}\n\n`));
          }

          // Save assistant message to SQLite
          saveMessage({
            id: assistantMessageId,
            conversationId,
            role: 'assistant',
            content: fullAssistantResponse,
            createdAt: Date.now(),
          });

          // Send completion event
          const doneData = JSON.stringify({
            type: 'done',
            conversationId,
            assistantMessageId,
            content: fullAssistantResponse,
          });
          controller.enqueue(encoder.encode(`event: done\ndata: ${doneData}\n\n`));
          controller.close();
        } catch (error: unknown) {
          const err = error as Error;
          console.error('[API/CHAT] Streaming error:', err);

          // If partial response was generated, persist what we have
          if (fullAssistantResponse) {
            saveMessage({
              id: assistantMessageId,
              conversationId,
              role: 'assistant',
              content: fullAssistantResponse + '\n\n*(Response interrupted)*',
              createdAt: Date.now(),
            });
          }

          const errorData = JSON.stringify({
            type: 'error',
            error: err.message || 'An error occurred during response generation.',
          });
          controller.enqueue(encoder.encode(`event: error\ndata: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API/CHAT] Top level error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process chat message.' },
      { status: 500 }
    );
  }
}

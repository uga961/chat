import { NextRequest, NextResponse } from 'next/server';
import { listConversations, createConversation } from '@/lib/db';
import { ResponseMode } from '@/lib/types';
import crypto from 'crypto';

export async function GET() {
  try {
    const conversations = listConversations();
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[API/CONVERSATIONS] List error:', error);
    return NextResponse.json({ error: 'Failed to retrieve conversations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id || crypto.randomUUID();
    const title = (body.title || 'New Technical Chat').trim().slice(0, 80);
    const mode = (['answer_only', 'short', 'detailed'].includes(body.mode)
      ? body.mode
      : 'answer_only') as ResponseMode;

    const conversation = createConversation(id, title, mode);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('[API/CONVERSATIONS] Create error:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

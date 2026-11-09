import { NextRequest, NextResponse } from 'next/server';
import { getConversation, getMessages, updateConversationTitle, updateConversationMode, deleteConversation } from '@/lib/db';
import { ResponseMode } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversation = await getConversation(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages = await getMessages(id, 100);
    return NextResponse.json({ conversation, messages });
  } catch (error) {
    console.error('[API/CONVERSATIONS/:ID] Get error:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversation = await getConversation(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const body = await request.json();
    if (body.title && typeof body.title === 'string') {
      await updateConversationTitle(id, body.title.trim().slice(0, 100));
    }
    if (body.mode && ['answer_only', 'short', 'detailed'].includes(body.mode)) {
      await updateConversationMode(id, body.mode as ResponseMode);
    }

    const updated = await getConversation(id);
    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error('[API/CONVERSATIONS/:ID] Update error:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteConversation(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/CONVERSATIONS/:ID] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}

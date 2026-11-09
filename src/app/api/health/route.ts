import { NextResponse } from 'next/server';
import { getDatabaseHealth } from '@/lib/db';
import { getGeminiModelName } from '@/lib/gemini';

export async function GET() {
  const dbHealth = getDatabaseHealth();
  const model = getGeminiModelName();
  const uptime = Math.floor(process.uptime());

  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const hasAccessKey = Boolean(process.env.APP_ACCESS_KEY && process.env.APP_ACCESS_KEY.trim().length > 0);

  const status = dbHealth.status === 'ok' && hasApiKey && hasAccessKey ? 'healthy' : 'degraded';

  return NextResponse.json({
    status,
    uptime,
    timestamp: new Date().toISOString(),
    service: 'chat-technical-assistant',
    model,
    configured: {
      geminiKeySet: hasApiKey,
      accessKeySet: hasAccessKey,
    },
    database: dbHealth,
  });
}

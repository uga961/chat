import test from 'node:test';
import assert from 'node:assert/strict';
import { getSystemPrompt } from '../src/lib/prompts.ts';
import {
  listConversations,
  createConversation,
  getConversation,
  updateConversationTitle,
  updateConversationMode,
  deleteConversation,
  saveMessage,
  getMessages,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  getDatabaseHealth,
} from '../src/lib/db.ts';
import { createSessionToken, verifySessionToken } from '../src/lib/session.ts';
import { verifyAccessKey, authenticateAttempt } from '../src/lib/auth.ts';
import { formatConversationContents, cleanBase64, getGeminiModelName } from '../src/lib/gemini.ts';

test('1. Response Modes and System Prompts', (t) => {
  const answerOnlyPrompt = getSystemPrompt('answer_only');
  assert.ok(answerOnlyPrompt.includes('CURRENT RESPONSE MODE: ANSWER ONLY'));
  assert.ok(answerOnlyPrompt.includes('Deliver ONLY the direct answer'));
  assert.ok(answerOnlyPrompt.includes('Option [Letter]: [Option text]'));
  assert.ok(answerOnlyPrompt.includes('Python'));
  assert.ok(answerOnlyPrompt.includes('SQL'));
  assert.ok(answerOnlyPrompt.includes('Excel'));

  assert.ok(answerOnlyPrompt.includes('CASE WHEN'));

  const shortPrompt = getSystemPrompt('short');
  assert.ok(shortPrompt.includes('CURRENT RESPONSE MODE: SHORT'));
  assert.ok(shortPrompt.includes('1 to 2 concise sentences'));

  const detailedPrompt = getSystemPrompt('detailed');
  assert.ok(detailedPrompt.includes('CURRENT RESPONSE MODE: DETAILED'));
  assert.ok(detailedPrompt.includes('comprehensive'));
});

test('2. Automatic Session Management (Without Manual SESSION_SECRET)', async (t) => {
  // Test when SESSION_SECRET is unset - it automatically derives from APP_ACCESS_KEY
  delete process.env.SESSION_SECRET;
  process.env.APP_ACCESS_KEY = 'auto-derived-key-123';

  const token = await createSessionToken();
  assert.ok(typeof token === 'string' && token.length > 20);

  const isValid = await verifySessionToken(token);
  assert.strictEqual(isValid, true);

  const isInvalid = await verifySessionToken(token + 'tampered');
  assert.strictEqual(isInvalid, false);

  const isBogus = await verifySessionToken('invalid.token.here');
  assert.strictEqual(isBogus, false);
});

test('3. Application Access Key and Timing-safe Authentication', (t) => {
  process.env.APP_ACCESS_KEY = 'correct-passphrase-999';

  assert.strictEqual(verifyAccessKey('correct-passphrase-999'), true);
  assert.strictEqual(verifyAccessKey('wrong-passphrase'), false);
  assert.strictEqual(verifyAccessKey(''), false);
});

test('4. Rate Limiting and Brute Force Protection', async (t) => {
  process.env.APP_ACCESS_KEY = 'valid-key';
  const testIp = '10.0.0.99';

  await resetRateLimit(testIp);

  // First 4 attempts should fail without blocking
  for (let i = 1; i <= 4; i++) {
    const res = await authenticateAttempt('bad-key', testIp);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.isBlocked, false);
  }

  // 5th failed attempt should trigger rate limiting block
  const blockedRes = await authenticateAttempt('bad-key', testIp);
  assert.strictEqual(blockedRes.success, false);
  assert.strictEqual(blockedRes.isBlocked, true);
  assert.ok(blockedRes.remainingSeconds > 0);

  // Subsequent check should stay blocked
  const check = await checkRateLimit(testIp);
  assert.strictEqual(check.isBlocked, true);

  // Clean up
  await resetRateLimit(testIp);
  const afterReset = await checkRateLimit(testIp);
  assert.strictEqual(afterReset.isBlocked, false);
});

test('5. LibSQL / SQLite Conversation and Message Persistence', async (t) => {
  const testConvId = `conv-${Date.now()}`;
  const conv = await createConversation(testConvId, 'Test SQL Window Function', 'answer_only');
  assert.strictEqual(conv.id, testConvId);
  assert.strictEqual(conv.title, 'Test SQL Window Function');
  assert.strictEqual(conv.mode, 'answer_only');

  // Verify fetch
  const fetched = await getConversation(testConvId);
  assert.ok(fetched);
  assert.strictEqual(fetched.id, testConvId);

  // Update title & mode
  await updateConversationTitle(testConvId, 'Updated Title');
  await updateConversationMode(testConvId, 'short');
  const updated = await getConversation(testConvId);
  assert.strictEqual(updated?.title, 'Updated Title');
  assert.strictEqual(updated?.mode, 'short');

  // Add messages
  const msg1 = await saveMessage({
    id: `m1-${Date.now()}`,
    conversationId: testConvId,
    role: 'user',
    content: 'How do I write a running total in PostgreSQL?',
  });
  assert.strictEqual(msg1.content, 'How do I write a running total in PostgreSQL?');

  const msg2 = await saveMessage({
    id: `m2-${Date.now()}`,
    conversationId: testConvId,
    role: 'assistant',
    content: 'SUM(amount) OVER (ORDER BY created_at)',
  });
  assert.strictEqual(msg2.role, 'assistant');

  // Retrieve messages
  const msgs = await getMessages(testConvId);
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual(msgs[0].role, 'user');
  assert.strictEqual(msgs[1].role, 'assistant');

  // List conversations
  const allConvs = await listConversations();
  const exists = allConvs.find((c) => c.id === testConvId);
  assert.ok(exists);
  assert.strictEqual(exists.messageCount, 2);

  // Delete conversation (cascade should delete messages too)
  await deleteConversation(testConvId);
  assert.strictEqual(await getConversation(testConvId), null);
  assert.strictEqual((await getMessages(testConvId)).length, 0);
});

test('6. Gemini Model Config and Multimodal Data Prep', (t) => {
  // Test cleanBase64
  const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const dataUri = `data:image/png;base64,${rawBase64}`;
  assert.strictEqual(cleanBase64(dataUri), rawBase64);
  assert.strictEqual(cleanBase64(rawBase64), rawBase64);

  // Test formatConversationContents
  const contents = formatConversationContents(
    [],
    'Calculate the correct option for this question:',
    [
      {
        id: 'att-1',
        name: 'question.png',
        mimeType: 'image/png',
        data: dataUri,
      },
    ]
  );

  assert.strictEqual(contents.length, 1);
  assert.strictEqual(contents[0].role, 'user');
  assert.strictEqual(contents[0].parts.length, 2);
  assert.strictEqual(contents[0].parts[0].inlineData.mimeType, 'image/png');
  assert.strictEqual(contents[0].parts[0].inlineData.data, rawBase64);
  assert.strictEqual(contents[0].parts[1].text, 'Calculate the correct option for this question:');

  // Test configurable model
  delete process.env.GEMINI_MODEL;
  assert.strictEqual(getGeminiModelName(), 'gemini-3.5-flash-lite');

  process.env.GEMINI_MODEL = 'gemini-3.5-flash';
  assert.strictEqual(getGeminiModelName(), 'gemini-3.5-flash');
});

test('7. Database Health Reporting', async (t) => {
  const health = await getDatabaseHealth();
  assert.strictEqual(health.status, 'ok');
  assert.ok(typeof health.conversationCount === 'number');
  assert.ok(typeof health.messageCount === 'number');
});

import { NextResponse, after, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { decryptValue } from '@/lib/crypto/server'
import { getAIProvider } from '@/lib/ai/factory'
import { logger } from '@/lib/utils/logger'

// Pemrosesan (termasuk generate AI) berjalan di after(), beri waktu cukup
export const maxDuration = 60

import { META_API_VERSION } from '@/lib/social/graph'

type ServiceClient = ReturnType<typeof createServiceClient>

// Helper to evaluate rules
async function evaluateChatbotRules(supabase: ServiceClient, businessUnitId: string, incomingText: string): Promise<{ action: 'reply' | 'handoff' | 'ai', replyText?: string, ruleContext?: string }> {
  const { data: rules } = await supabase
    .from('chatbot_rules')
    .select('*')
    .eq('business_unit_id', businessUnitId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (rules && rules.length > 0) {
    const textLower = incomingText.toLowerCase();
    for (const rule of rules) {
      const keywords = rule.trigger_keyword.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
      for (const kw of keywords) {
        if (textLower.includes(kw)) {
          if (rule.reply_mode === 'static_text') {
            return { action: 'reply', replyText: rule.response_content };
          } else if (rule.reply_mode === 'human_handoff') {
            return { action: 'handoff' };
          } else if (rule.reply_mode === 'ai_generated') {
            return { action: 'ai', ruleContext: rule.response_content };
          }
        }
      }
    }
  }

  return { action: 'ai' };
}

// Meta mengirim ulang event yang sama saat retry — lewati pesan yang sudah tersimpan
async function isDuplicateMessage(supabase: ServiceClient, platformMessageId: string | null | undefined): Promise<boolean> {
  if (!platformMessageId) return false;
  const { data } = await supabase
    .from('social_messages')
    .select('id')
    .eq('platform_message_id', platformMessageId)
    .limit(1);
  return !!data && data.length > 0;
}

async function findAccountByIgId(supabase: ServiceClient, igUserId: string) {
  const { data: account } = await supabase
    .from('social_accounts')
    .select('*, business_units(user_id, ai_system_prompt)')
    .eq('ig_user_id', igUserId)
    .single();
  if (!account || !account.business_units) return null;
  return account;
}

// Cari atau buat conversation, lalu update latest message & unread count
async function upsertConversation(
  supabase: ServiceClient,
  account: { id: string; business_unit_id: string; platform: string },
  type: 'comment' | 'dm',
  customerId: string,
  customerName: string,
  content: string,
): Promise<string | undefined> {
  const { data: existingConv } = await supabase
    .from('social_conversations')
    .select('id, unread_count')
    .eq('account_id', account.id)
    .eq('type', type)
    .eq('customer_id', customerId)
    .single();

  if (existingConv) {
    await supabase.from('social_conversations')
      .update({
        latest_message: content,
        latest_message_at: new Date().toISOString(),
        unread_count: (existingConv.unread_count || 0) + 1,
      })
      .eq('id', existingConv.id);
    return existingConv.id;
  }

  const { data: newConv, error: convErr } = await supabase.from('social_conversations').insert({
    business_unit_id: account.business_unit_id,
    account_id: account.id,
    platform: account.platform,
    type,
    customer_id: customerId,
    customer_name: customerName,
    latest_message: content,
    unread_count: 1,
  }).select('id').single();
  if (convErr) logger.error(`Supabase insert conv (${type}) error:`, convErr);
  return newConv?.id;
}

async function generateReply(
  supabase: ServiceClient,
  userId: string,
  businessUnitId: string,
  incomingText: string,
  buildPrompt: (ruleInject: string) => string,
  systemRole: string,
  maxTokens: number,
): Promise<string | null> {
  const ruleEval = await evaluateChatbotRules(supabase, businessUnitId, incomingText);

  if (ruleEval.action === 'handoff') return null;
  if (ruleEval.action === 'reply' && ruleEval.replyText) return ruleEval.replyText;

  const { client } = await getAIProvider(userId);
  const ruleInject = ruleEval.ruleContext ? `\nINSTRUKSI KHUSUS DARI RULE: ${ruleEval.ruleContext}\n` : '';
  const aiResponse = await client.generateText(systemRole, buildPrompt(ruleInject), { temperature: 0.7, maxTokens });
  return aiResponse.content.trim().replace(/"/g, ''); // bersihkan tanda kutip jika AI iseng
}

async function sendDmReply(supabase: ServiceClient, accessTokenEncrypted: string, conversationId: string, recipientId: string, replyText: string) {
  const token = decryptValue(accessTokenEncrypted);
  const postReply = await fetch(`https://graph.facebook.com/${META_API_VERSION}/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text: replyText } })
  });

  if (!postReply.ok) {
    logger.error('Gagal mengirim DM ke Meta:', await postReply.text());
    return;
  }

  logger.info(`DM reply sent to ${recipientId}`);
  const dmReplyData = await postReply.json().catch(() => ({}));
  await supabase.from('social_messages').insert({
    conversation_id: conversationId,
    sender_type: 'ai_auto',
    content: replyText,
    platform_message_id: dmReplyData.message_id || null,
    status: 'sent',
    sent_at: new Date().toISOString(),
  });
}

// KOMENTAR MASUK
async function handleComment(supabase: ServiceClient, igUserId: string, commentVal: { id: string; text: string; from?: { id?: string; username?: string } }) {
  const commentId = commentVal.id;
  const commentText = commentVal.text || '';
  const commenterUsername = commentVal.from?.username;

  // Kita tidak perlu membalas komentar dari akun kita sendiri
  if (commentVal.from?.id === igUserId) return;
  if (await isDuplicateMessage(supabase, commentId)) return;

  const account = await findAccountByIgId(supabase, igUserId);
  if (!account) {
    logger.warn(`Account not found for IG: ${igUserId}`);
    return;
  }

  const customerId = commentVal.from?.id || commenterUsername || 'unknown';
  const conversationId = await upsertConversation(supabase, account, 'comment', customerId, commenterUsername || 'User', commentText);

  if (conversationId) {
    const { error: msgErr } = await supabase.from('social_messages').insert({
      conversation_id: conversationId,
      sender_type: 'customer',
      content: commentText,
      platform_message_id: commentId
    });
    if (msgErr) logger.error('Supabase insert msg error:', msgErr);
  }

  if (!account.auto_reply_enabled) return;

  const systemPrompt = account.business_units.ai_system_prompt || 'Anda adalah asisten admin ramah.';
  const replyText = await generateReply(
    supabase,
    account.business_units.user_id,
    account.business_unit_id,
    commentText,
    (ruleInject) => `
Konteks Bisnis: ${systemPrompt}${ruleInject}

Seorang pelanggan (username: @${commenterUsername}) baru saja berkomentar di postingan Instagram bisnis Anda.
Komentar: "${commentText}"

Tugas Anda:
Buatlah balasan komentar yang super singkat, ramah, dan profesional. Jangan gunakan hashtag. Langsung balas saja ke inti percakapan. Jika pelanggan bertanya, jawab. Maksimal 2 kalimat.
`,
    'Anda adalah admin sosial media yang interaktif.',
    150,
  );

  if (!replyText) {
    logger.info(`Comment handoff rule triggered, comment ID: ${commentId}`);
    return;
  }

  const token = decryptValue(account.access_token_encrypted);
  const replyParams = new URLSearchParams();
  replyParams.append('message', replyText);
  replyParams.append('access_token', token);

  const postReply = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${commentId}/replies`, {
    method: 'POST',
    body: replyParams
  });

  if (!postReply.ok) {
    logger.error('Gagal mengirim balasan ke Meta:', await postReply.text());
    return;
  }

  logger.info(`Reply sent to @${commenterUsername}`);
  const replyData = await postReply.json().catch(() => ({}));
  await supabase.from('social_messages').insert({
    conversation_id: conversationId,
    sender_type: 'ai_auto',
    content: replyText,
    platform_message_id: replyData.id || null,
    status: 'sent',
    sent_at: new Date().toISOString(),
  });
}

// DM — format modern Instagram API (changes[].field === 'messages')
async function handleModernDm(supabase: ServiceClient, recipientId: string, msg: { id?: string; text?: string; from?: { id?: string }; attachments?: unknown[] }) {
  const senderId = msg.from?.id;
  const messageText = msg.text || '';
  const messageId = msg.id;
  const hasMedia = (msg.attachments?.length || 0) > 0;

  if (!senderId || senderId === recipientId) return;
  if (await isDuplicateMessage(supabase, messageId)) return;

  const account = await findAccountByIgId(supabase, recipientId);
  if (!account) return;

  // Fetch real customer name dari Instagram API
  let displayName = `IG User ${senderId}`;
  try {
    const token = decryptValue(account.access_token_encrypted);
    const userRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${senderId}?fields=id,username,name&access_token=${token}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    const userData = await userRes.json();
    if (!userData.error) {
      displayName = userData.name || userData.username || displayName;
    }
  } catch {
    logger.warn('Failed to fetch Instagram user name, using fallback');
  }

  const content = hasMedia ? `${messageText || '(Media dikirim)'}` : messageText;
  const conversationId = await upsertConversation(supabase, account, 'dm', senderId, displayName, content);

  if (conversationId) {
    await supabase.from('social_messages').insert({
      conversation_id: conversationId,
      sender_type: 'customer',
      content,
      platform_message_id: messageId || null,
    });
  }

  if (!account.auto_reply_enabled || !conversationId) return;

  const systemPrompt = account.business_units.ai_system_prompt || 'Anda adalah asisten CS.';
  const replyText = await generateReply(
    supabase,
    account.business_units.user_id,
    account.business_unit_id,
    messageText,
    (ruleInject) => `
Konteks Bisnis: ${systemPrompt}${ruleInject}

Pelanggan (${displayName}) mengirim DM: "${messageText}"
Balas dengan natural dan ramah. Maksimal 3 kalimat.`,
    'Anda adalah Customer Service yang ramah.',
    200,
  );
  if (!replyText) return;

  await sendDmReply(supabase, account.access_token_encrypted, conversationId, senderId, replyText);
}

// DM — legacy format (Facebook Messenger PSID-based, entry.messaging[])
async function handleLegacyDm(supabase: ServiceClient, msgEvent: { sender: { id: string }; recipient: { id: string }; message: { text: string; mid?: string } }) {
  const senderId = msgEvent.sender.id;
  const recipientId = msgEvent.recipient.id;
  const messageText = msgEvent.message.text;
  const messageId = msgEvent.message.mid;

  if (senderId === recipientId) return;
  if (await isDuplicateMessage(supabase, messageId)) return;

  const account = await findAccountByIgId(supabase, recipientId);
  if (!account) return;

  const conversationId = await upsertConversation(supabase, account, 'dm', senderId, `IG User ${senderId}`, messageText);

  if (conversationId) {
    const { error: msgErr } = await supabase.from('social_messages').insert({
      conversation_id: conversationId,
      sender_type: 'customer',
      content: messageText,
      platform_message_id: messageId || null
    });
    if (msgErr) logger.error('Supabase insert msg DM error:', msgErr);
  }

  if (!account.auto_reply_enabled || !conversationId) return;

  const systemPrompt = account.business_units.ai_system_prompt || 'Anda adalah asisten CS.';
  const replyText = await generateReply(
    supabase,
    account.business_units.user_id,
    account.business_unit_id,
    messageText,
    (ruleInject) => `
Konteks Bisnis: ${systemPrompt}${ruleInject}

Pelanggan mengirimkan Direct Message (DM) ke Instagram bisnis Anda.
Pesan: "${messageText}"

Tugas Anda:
Buatlah balasan DM yang natural, membantu, dan persuasif. Hindari format kaku. Jawab pertanyaan mereka dengan jelas. Maksimal 3 kalimat.
`,
    'Anda adalah representatif Customer Service yang sangat responsif.',
    200,
  );

  if (!replyText) {
    logger.info(`DM handoff rule triggered, sender ID: ${senderId}`);
    return;
  }

  await sendDmReply(supabase, account.access_token_encrypted, conversationId, senderId, replyText);
}

// Setiap event diproses terisolasi: satu event gagal tidak menggagalkan event lain
async function runSafely(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    logger.error(`Webhook ${label} handler error:`, err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processWebhookBody(body: any) {
  const supabase = createServiceClient();

  for (const entry of body.entry) {
    const igUserId = entry.id;
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      if (change.field === 'comments' && change.value) {
        await runSafely('comment', () => handleComment(supabase, igUserId, change.value));
      } else if (change.field === 'messages' && change.value?.messages) {
        for (const msg of change.value.messages) {
          await runSafely('dm', () => handleModernDm(supabase, change.value.id, msg));
        }
      }
    }

    if (Array.isArray(entry.messaging)) {
      for (const msgEvent of entry.messaging) {
        if (msgEvent.message?.text && !msgEvent.message.is_echo) {
          await runSafely('legacy-dm', () => handleLegacyDm(supabase, msgEvent));
        }
      }
    }
  }
}

// VERIFIKASI WEBHOOK DARI META
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // C10 Fix: Remove hardcoded fallback
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (!VERIFY_TOKEN) {
    return new NextResponse('Internal Server Error: Missing Verify Token config', { status: 500 })
  }

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      logger.info('Webhook verified successfully')
      return new NextResponse(challenge, { status: 200 })
    } else {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  return new NextResponse('Bad Request', { status: 400 })
}

function isValidSignature(rawBody: string, signature: string, appSecret: string): boolean {
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`)
  const received = Buffer.from(signature)
  return expected.length === received.length && crypto.timingSafeEqual(expected, received)
}

// MENANGKAP PAYLOAD WEBHOOK (KOMENTAR & DM MASUK)
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    // C9 Fix: Verifikasi HMAC-SHA-256 Signature
    const signature = request.headers.get('x-hub-signature-256')
    const appSecret = process.env.META_APP_SECRET

    if (!appSecret) {
      logger.error('META_APP_SECRET is not configured')
      return new NextResponse('Internal Server Error', { status: 500 })
    }

    if (!signature) {
      return new NextResponse('Forbidden: Missing signature', { status: 403 })
    }

    if (!isValidSignature(rawBody, signature, appSecret)) {
      return new NextResponse('Forbidden: Invalid signature', { status: 403 })
    }

    const body = JSON.parse(rawBody)

    // Cek apakah webhook dari Instagram atau Page (karena IG DM di-routing via Page)
    if ((body.object === 'instagram' || body.object === 'page') && Array.isArray(body.entry)) {
      // Balas Meta secepatnya agar tidak timeout & retry; proses (termasuk AI) setelah response
      after(() => processWebhookBody(body))
      return new NextResponse('EVENT_RECEIVED', { status: 200 })
    }

    return new NextResponse('Bad Request', { status: 400 })
  } catch (err: unknown) {
    logger.error('Webhook Error:', err);
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

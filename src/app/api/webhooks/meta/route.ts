import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { decryptValue } from '@/lib/crypto/server'
import { getAIProvider } from '@/lib/ai/factory'
// Helper to evaluate rules
async function evaluateChatbotRules(supabase: any, businessUnitId: string, incomingText: string): Promise<{ action: 'reply' | 'handoff' | 'ai', replyText?: string, ruleContext?: string }> {
  const { data: rules } = await supabase
    .from('chatbot_rules')
    .select('*')
    .eq('business_unit_id', businessUnitId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (rules && rules.length > 0) {
    const textLower = incomingText.toLowerCase();
    for (const rule of rules) {
      const keywords = rule.trigger_keyword.split(',').map((k: string) => k.trim().toLowerCase());
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
      console.log('WEBHOOK_VERIFIED')
      return new NextResponse(challenge, { status: 200 })
    } else {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  return new NextResponse('Bad Request', { status: 400 })
}

import crypto from 'crypto'

import { logger } from '@/lib/utils/logger'
// MENANGKAP PAYLOAD WEBHOOK (KOMENTAR MASUK)
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
    
    const expectedSignature = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
    if (signature !== expectedSignature) {
      return new NextResponse('Forbidden: Invalid signature', { status: 403 })
    }

    const body = JSON.parse(rawBody)

    // Cek apakah webhook dari Instagram
    if (body.object === 'instagram' && body.entry) {
      for (const entry of body.entry) {
        const igUserId = entry.id
        
        for (const change of entry.changes) {
          if (change.field === 'comments') {
            const commentVal = change.value
            const commentId = commentVal.id
            const commentText = commentVal.text
            const commenterUsername = commentVal.from?.username
            
            // Kita tidak perlu membalas komentar dari akun kita sendiri
            if (commentVal.from?.id === igUserId) continue;

            // 1. Cari akun di DB dengan service_role (bypassing RLS)
            const supabase = createServiceClient()
            const { data: account } = await supabase
              .from('social_accounts')
              .select('*, business_units(user_id, ai_system_prompt)')
              .eq('ig_user_id', igUserId)
              .single()

            if (!account || !account.business_units) {
              console.log(`Account not found for IG: ${igUserId}`);
              continue;
            }

            // SIMPAN PERCAKAPAN & PESAN MASUK
            const customerId = commentVal.from?.id || commenterUsername || 'unknown';
            let conversationId;
            const { data: existingConv } = await supabase
              .from('social_conversations')
              .select('id')
              .eq('account_id', account.id)
              .eq('type', 'comment')
              .eq('customer_id', customerId)
              .single();

            if (existingConv) {
              conversationId = existingConv.id;
              await supabase.from('social_conversations')
                .update({ latest_message: commentText, latest_message_at: new Date().toISOString() })
                .eq('id', conversationId);
            } else {
              const { data: newConv } = await supabase.from('social_conversations').insert({
                business_unit_id: account.business_unit_id,
                account_id: account.id,
                platform: account.platform,
                type: 'comment',
                customer_id: customerId,
                customer_name: commenterUsername || 'User',
                latest_message: commentText,
              }).select('id').single();
              conversationId = newConv?.id;
            }

            if (conversationId) {
              await supabase.from('social_messages').insert({
                conversation_id: conversationId,
                sender_type: 'customer',
                content: commentText,
                platform_message_id: commentId
              });
            }

            // LANJUT KE AUTO-REPLY JIKA AKTIF
            if (!account.auto_reply_enabled) {
              continue;
            }

            const userId = account.business_units.user_id;
            const businessUnitId = account.business_unit_id;
            const systemPrompt = account.business_units.ai_system_prompt || 'Anda adalah asisten admin ramah.';

            const ruleEval = await evaluateChatbotRules(supabase, businessUnitId, commentText);

            if (ruleEval.action === 'handoff') {
              console.log(`[Handoff] Komentar diabaikan karena Rule Handoff. ID: ${commentId}`);
              continue;
            }

            let replyText = '';

            if (ruleEval.action === 'reply' && ruleEval.replyText) {
              replyText = ruleEval.replyText;
            } else {
              // 2. Generate Balasan dengan AI
              const { client, config } = await getAIProvider(userId);
              
              const ruleInject = ruleEval.ruleContext ? `\nINSTRUKSI KHUSUS DARI RULE: ${ruleEval.ruleContext}\n` : '';
              
              const aiPrompt = `
Konteks Bisnis: ${systemPrompt}${ruleInject}

Seorang pelanggan (username: @${commenterUsername}) baru saja berkomentar di postingan Instagram bisnis Anda.
Komentar: "${commentText}"

Tugas Anda:
Buatlah balasan komentar yang super singkat, ramah, dan profesional. Jangan gunakan hashtag. Langsung balas saja ke inti percakapan. Jika pelanggan bertanya, jawab. Maksimal 2 kalimat.
`;

              const aiResponse = await client.generateText(
                "Anda adalah admin sosial media yang interaktif.",
                aiPrompt,
                { temperature: 0.7, maxTokens: 150 }
              );

              replyText = aiResponse.content.trim().replace(/"/g, ''); // bersihkan tanda kutip jika AI iseng
            }

            // 3. Kirim Balasan ke Meta Graph API
            const token = decryptValue(account.access_token_encrypted);
            const graphUrl = `https://graph.facebook.com/v18.0/${commentId}/replies`;
            
            const replyParams = new URLSearchParams();
            replyParams.append('message', replyText);
            replyParams.append('access_token', token);

            const postReply = await fetch(graphUrl, {
              method: 'POST',
              body: replyParams
            });

            if (!postReply.ok) {
              const errData = await postReply.text();
              logger.error('Gagal mengirim balasan ke Meta:', errData);
            } else {
              console.log(`Berhasil membalas komentar @${commenterUsername} -> ${replyText}`);
              
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
          }
        }

        // Penanganan Direct Message (DM)
        if (entry.messaging) {
          for (const msgEvent of entry.messaging) {
            if (msgEvent.message && msgEvent.message.text) {
              const senderId = msgEvent.sender.id;
              const recipientId = msgEvent.recipient.id; // Harus sama dengan igUserId
              const messageText = msgEvent.message.text;

              if (senderId === recipientId) continue;

              const supabase = createServiceClient()
              const { data: account } = await supabase
                .from('social_accounts')
                .select('*, business_units(user_id, ai_system_prompt)')
                .eq('ig_user_id', recipientId)
                .single()

              if (!account || !account.business_units) continue;

              // SIMPAN PERCAKAPAN & PESAN MASUK DM
              const customerId = senderId;
              let conversationId;
              const { data: existingConv } = await supabase
                .from('social_conversations')
                .select('id')
                .eq('account_id', account.id)
                .eq('type', 'dm')
                .eq('customer_id', customerId)
                .single();

              if (existingConv) {
                conversationId = existingConv.id;
                await supabase.from('social_conversations')
                  .update({ latest_message: messageText, latest_message_at: new Date().toISOString() })
                  .eq('id', conversationId);
              } else {
                const { data: newConv } = await supabase.from('social_conversations').insert({
                  business_unit_id: account.business_unit_id,
                  account_id: account.id,
                  platform: account.platform,
                  type: 'dm',
                  customer_id: customerId,
                  customer_name: `IG User ${customerId}`,
                  latest_message: messageText,
                }).select('id').single();
                conversationId = newConv?.id;
              }

              if (conversationId) {
                await supabase.from('social_messages').insert({
                  conversation_id: conversationId,
                  sender_type: 'customer',
                  content: messageText,
                  platform_message_id: msgEvent.message.mid || null
                });
              }

              // LANJUT KE AUTO-REPLY JIKA AKTIF
              if (!account.auto_reply_enabled) {
                continue;
              }

              const userId = account.business_units.user_id;
              const businessUnitId = account.business_unit_id;
              const systemPrompt = account.business_units.ai_system_prompt || 'Anda adalah asisten CS.';

              const ruleEval = await evaluateChatbotRules(supabase, businessUnitId, messageText);

              if (ruleEval.action === 'handoff') {
                console.log(`[Handoff] DM diabaikan karena Rule Handoff. ID: ${senderId}`);
                continue;
              }

              let replyText = '';

              if (ruleEval.action === 'reply' && ruleEval.replyText) {
                replyText = ruleEval.replyText;
              } else {
                const { client } = await getAIProvider(userId);
                
                const ruleInject = ruleEval.ruleContext ? `\nINSTRUKSI KHUSUS DARI RULE: ${ruleEval.ruleContext}\n` : '';
                
                const aiPrompt = `
Konteks Bisnis: ${systemPrompt}${ruleInject}

Pelanggan mengirimkan Direct Message (DM) ke Instagram bisnis Anda.
Pesan: "${messageText}"

Tugas Anda:
Buatlah balasan DM yang natural, membantu, dan persuasif. Hindari format kaku. Jawab pertanyaan mereka dengan jelas. Maksimal 3 kalimat.
`;
                const aiResponse = await client.generateText(
                  "Anda adalah representatif Customer Service yang sangat responsif.",
                  aiPrompt,
                  { temperature: 0.7, maxTokens: 200 }
                );

                replyText = aiResponse.content.trim().replace(/"/g, '');
              }

              const token = decryptValue(account.access_token_encrypted);
              const graphUrl = `https://graph.facebook.com/v18.0/me/messages`;
              
              const postReply = await fetch(graphUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  recipient: { id: senderId },
                  message: { text: replyText }
                })
              });

              if (!postReply.ok) {
                const errData = await postReply.text();
                logger.error('Gagal mengirim DM ke Meta:', errData);
              } else {
                console.log(`Berhasil membalas DM ke ${senderId} -> ${replyText}`);
                
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
            }
          }
        }
      }
      return new NextResponse('EVENT_RECEIVED', { status: 200 })
    }

    return new NextResponse('Bad Request', { status: 400 })
  } catch (err: unknown) {
    logger.error('Webhook Error:', err);
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

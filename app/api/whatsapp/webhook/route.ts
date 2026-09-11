import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { generateAiReply } from '@/utils/whatsappAi';

// Meta Webhook Verification Handler (GET)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'aadvik_secret_token_2026';

  if (mode === 'subscribe' && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// Meta Webhook Message Receiver (POST)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if this is a WhatsApp message event
    if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const changeVal = body.entry[0].changes[0].value;
      const messageObj = changeVal.messages[0];
      const contactObj = changeVal.contacts?.[0];

      const senderPhone = messageObj.from; // e.g. "919876543210"
      const customerName = contactObj?.profile?.name || 'Guest';
      const customerText = messageObj.text?.body || messageObj.caption || '';

      if (customerText) {
        // 1. Get or create conversation in Supabase
        let conversationId: number | null = null;
        let isAiEnabled = true;

        const { data: conv } = await supabase
          .from('WhatsAppConversations')
          .select('*')
          .eq('customer_phone', senderPhone)
          .maybeSingle();

        if (conv) {
          conversationId = conv.id;
          isAiEnabled = conv.ai_enabled ?? true;

          await supabase
            .from('WhatsAppConversations')
            .update({
              last_message: customerText.slice(0, 100),
              last_message_at: new Date().toISOString(),
              unread_count: (conv.unread_count || 0) + 1
            })
            .eq('id', conversationId);
        } else {
          const { data: newConv } = await supabase
            .from('WhatsAppConversations')
            .insert({
              customer_phone: senderPhone,
              customer_name: customerName,
              last_message: customerText.slice(0, 100),
              last_message_at: new Date().toISOString(),
              unread_count: 1,
              ai_enabled: true
            })
            .select('*')
            .single();

          if (newConv) {
            conversationId = newConv.id;
            isAiEnabled = true;
          }
        }

        // 2. Save Customer message to WhatsAppMessages
        if (conversationId) {
          await supabase
            .from('WhatsAppMessages')
            .insert({
              conversation_id: conversationId,
              sender: 'customer',
              message_text: customerText,
              status: 'delivered'
            });

          // 3. If AI Auto-Reply is enabled, generate and send reply
          if (isAiEnabled) {
            const aiReplyText = await generateAiReply(customerText, customerName);

            // Save AI reply to database
            await supabase
              .from('WhatsAppMessages')
              .insert({
                conversation_id: conversationId,
                sender: 'ai',
                message_text: aiReplyText,
                status: 'sent'
              });

            // Update conversation last message
            await supabase
              .from('WhatsAppConversations')
              .update({
                last_message: aiReplyText.slice(0, 100),
                last_message_at: new Date().toISOString()
              })
              .eq('id', conversationId);

            // Send via Meta Cloud API if configured
            const whatsappToken = process.env.WHATSAPP_TOKEN;
            const whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

            if (whatsappToken && whatsappPhoneId) {
              await fetch(`https://graph.facebook.com/v21.0/${whatsappPhoneId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${whatsappToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: senderPhone,
                  type: 'text',
                  text: { preview_url: false, body: aiReplyText }
                })
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

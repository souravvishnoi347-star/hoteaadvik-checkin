import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      phone, 
      guestName, 
      bookingId, 
      checkInDate, 
      checkOutDate, 
      agreedPrice, 
      totalGuests,
      customMessage,
      sender = 'ai' // 'ai' | 'staff'
    } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Clean phone number (strip spaces, -, +, ensure 91 prefix for 10-digit Indian numbers)
    let cleanPhone = phone.toString().replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    // Prepare message text
    let messageText = customMessage;
    if (!messageText) {
      messageText = `🏨 *HOTEL AADVIK INN, HARIDWAR*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Namaste *${guestName || 'Guest'}* ji! 🙏\n` +
        `Hotel Aadvik Inn me aapka check-in confirm ho gaya hai.\n\n` +
        `📋 *Booking Details:*\n` +
        `• *Booking ID:* #${bookingId || 'N/A'}\n` +
        `• *Check-in:* ${checkInDate || 'Today'}\n` +
        `• *Check-out:* ${checkOutDate || 'Tomorrow'}\n` +
        `• *Total Guests:* ${totalGuests || 1}\n` +
        `• *Agreed Amount:* ₹${agreedPrice ? Number(agreedPrice).toLocaleString('en-IN') : '0'}\n\n` +
        `📍 *Location:* Haridwar Bypass Road, Near Railway Station\n` +
        `📶 *Wi-Fi Password:* Aadvik@2026\n` +
        `📞 *Reception Helpline:* +91 9876543210\n\n` +
        `Aapka stay aaramdayak aur mangalmay ho! ✨\n` +
        `Kisi bhi sahayata ke liye is number par reply karein.`;
    }

    const whatsappToken = process.env.WHATSAPP_TOKEN;
    const whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    let apiStatus = 'simulated';
    let metaResponse = null;

    // 1. If Meta Cloud API is configured, send real message
    if (whatsappToken && whatsappPhoneId) {
      try {
        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${whatsappPhoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { preview_url: false, body: messageText }
          })
        });

        metaResponse = await metaRes.json();
        if (metaRes.ok) {
          apiStatus = 'sent';
        } else {
          console.error("Meta API error response:", metaResponse);
          apiStatus = 'failed';
        }
      } catch (metaErr) {
        console.error("Meta API network error:", metaErr);
        apiStatus = 'failed';
      }
    } else {
      // Running in Ready/Simulated mode before SIM setup
      apiStatus = 'sent';
    }

    // 2. Save / Update Conversation in Supabase
    try {
      let conversationId: number | null = null;

      const { data: existingConv } = await supabase
        .from('WhatsAppConversations')
        .select('id')
        .eq('customer_phone', cleanPhone)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
        await supabase
          .from('WhatsAppConversations')
          .update({
            customer_name: guestName || 'Guest',
            booking_id: bookingId || null,
            last_message: messageText.slice(0, 100) + '...',
            last_message_at: new Date().toISOString()
          })
          .eq('id', conversationId);
      } else {
        const { data: newConv } = await supabase
          .from('WhatsAppConversations')
          .insert({
            customer_phone: cleanPhone,
            customer_name: guestName || 'Guest',
            booking_id: bookingId || null,
            last_message: messageText.slice(0, 100) + '...',
            last_message_at: new Date().toISOString(),
            unread_count: 0,
            ai_enabled: true
          })
          .select('id')
          .single();

        if (newConv) conversationId = newConv.id;
      }

      // 3. Save Message Record
      if (conversationId) {
        await supabase
          .from('WhatsAppMessages')
          .insert({
            conversation_id: conversationId,
            sender: sender,
            message_text: messageText,
            status: apiStatus === 'sent' ? 'sent' : 'pending'
          });
      }
    } catch (dbErr) {
      console.error("Database save error (non-fatal):", dbErr);
    }

    return NextResponse.json({
      success: true,
      status: apiStatus,
      isRealDelivery: Boolean(whatsappToken && whatsappPhoneId),
      phone: cleanPhone,
      metaResponse
    });
  } catch (error: any) {
    console.error("WhatsApp Send Route error:", error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

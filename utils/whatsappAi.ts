/**
 * Hotel Aadvik Inn - AI Virtual Receptionist Engine
 * Answers customer questions via OpenRouter / Gemini API or intelligent fallback.
 */

const HOTEL_KNOWLEDGE_BASE = `
Hotel Name: HOTEL AADVIK INN
Location: Haridwar, Uttarakhand (Near Railway Station & Har Ki Pauri)
Frontdesk: 24/7 Available
Check-in Time: 12:00 PM (Noon)
Check-out Time: 11:00 AM
Wi-Fi: Free High-Speed Wi-Fi in all rooms (Password: Aadvik@2026)
Food & Room Service: 7:00 AM to 10:30 PM (Pure Vegetarian & North Indian available)
Har Ki Pauri Distance: ~2.5 km (E-rickshaw & autos easily available right outside)
Parking: Free valet and on-site parking for hotel guests.
Hot Water: Available 24 hours in all attached washrooms.
Extra Bedding / Blanket: Available upon request from reception dial '9'.
`;

export async function generateAiReply(userQuery: string, guestName?: string): Promise<string> {
  const queryLower = userQuery.toLowerCase().trim();

  // 1. Try LLM (OpenRouter / Gemini / OpenAI) if keys are provided
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (openRouterKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://hotelaadvik.com",
          "X-Title": "Hotel Aadvik AI Receptionist"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3-8b-instruct:free",
          messages: [
            {
              role: "system",
              content: `You are the friendly, polite AI Virtual Concierge of Hotel Aadvik Inn, Haridwar. 
Grounded Facts about the hotel:
${HOTEL_KNOWLEDGE_BASE}

Instructions:
- Keep answers short, warm, helpful, and concise (under 2-3 sentences), formatted nicely for WhatsApp with emojis.
- Reply in the language the guest uses (Hindi, Hinglish, or English).
- If guest name is provided (${guestName || 'Guest'}), address them warmly.
- If you do not know something, politely ask them to contact frontdesk directly.`
            },
            {
              role: "user",
              content: userQuery
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return reply.trim();
      }
    } catch (e) {
      console.error("OpenRouter API error:", e);
    }
  }

  if (geminiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are the Virtual Concierge of Hotel Aadvik Inn, Haridwar.
Hotel Details: ${HOTEL_KNOWLEDGE_BASE}
Guest Name: ${guestName || 'Guest'}
User message: "${userQuery}"

Reply warmly and concisely for WhatsApp in 2-3 lines with emojis in Hindi/English as appropriate.`
                }
              ]
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return reply.trim();
      }
    } catch (e) {
      console.error("Gemini API error:", e);
    }
  }

  // 2. Intelligent Built-in Rule Engine Fallback (Works 100% offline without any API keys!)
  if (queryLower.includes("wifi") || queryLower.includes("wi-fi") || queryLower.includes("internet") || queryLower.includes("password")) {
    return `📶 *Wi-Fi Details:*\nNetwork Name: *AadvikGuest*\nPassword: *Aadvik@2026*\n\nHigh-speed internet aapke room me 24/7 available hai! Agar koi dikkat aaye toh reception dial karein. 🙏`;
  }

  if (queryLower.includes("checkout") || queryLower.includes("check out") || queryLower.includes("time") && queryLower.includes("out")) {
    return `⏰ *Check-out Time:*\nHamara standard check-out time *11:00 AM* hai.\nAgar aapko late check-out chahiye toh kripya reception par call karke check kar sakte hain. 🙏`;
  }

  if (queryLower.includes("checkin") || queryLower.includes("check in") || queryLower.includes("entry")) {
    return `🏨 *Check-in Time:*\nHamara standard check-in time *12:00 PM (Noon)* hai.\nAapka kamra taiyar hai! 🙏`;
  }

  if (queryLower.includes("khana") || queryLower.includes("food") || queryLower.includes("dinner") || queryLower.includes("lunch") || queryLower.includes("breakfast") || queryLower.includes("menu")) {
    return `🍽️ *Room Service & Dining:*\nKitchen timings: *7:00 AM se 10:30 PM* tak available hai.\nShudh shakahari (Pure Veg) North Indian dishes uplabdh hain. Order ke liye reception par dial karein! 🍲`;
  }

  if (queryLower.includes("pauri") || queryLower.includes("mandir") || queryLower.includes("distance") || queryLower.includes("door") || queryLower.includes("ghat")) {
    return `🛕 *Har Ki Pauri / Ghat:*\nHar Ki Pauri hotel se lagbhag *2.5 km* doori par hai. Hotel ke bahar se e-rickshaw aur auto aasaani se mil jate hain (10 minutes drive). 🙏✨`;
  }

  if (queryLower.includes("location") || queryLower.includes("address") || queryLower.includes("kaha") || queryLower.includes("map")) {
    return `📍 *Hotel Aadvik Inn Address:*\nHaridwar Bypass Road, Near Railway Station, Haridwar, Uttarakhand.\nGoogle Maps par "Hotel Aadvik Inn" search karein ya reception number par call karein. 🗺️`;
  }

  if (queryLower.includes("pani") || queryLower.includes("water") || queryLower.includes("geyser") || queryLower.includes("garm")) {
    return `🚿 *Hot Water & Amenities:*\nGarm paani (Hot Water) 24 ghante uplabdh hai. Kripya geyser switch on karein ya housekeeping ko contact karein. 🙏`;
  }

  if (queryLower.includes("hi") || queryLower.includes("hello") || queryLower.includes("namaste") || queryLower.includes("hey")) {
    return `Namaste ${guestName || ''}! 🙏 Hotel Aadvik Inn me aapka swagat hai. Main aapka AI Virtual Assistant hoon. Main aapki kya sahayata kar sakta hoon? ✨`;
  }

  // Default polite concierge response
  return `Namaste ${guestName || ''}! 🙏 Aapke sandesh ke liye dhanyawad. Hotel Aadvik Inn me aapki stay aaramdayak rahe, iske liye hum 24/7 uplabdh hain. Kisi bhi immediate assistance ke liye kripya reception desk par sampark karein ya room se '9' dial karein! ✨`;
}

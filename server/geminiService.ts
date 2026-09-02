import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiInstance;
}

export async function generateBotResponse(
  systemPrompt: string,
  userMessage: string,
  userName: string = 'User',
  knowledgeBase?: string
): Promise<string> {
  const client = getAiClient();

  if (!client) {
    // Intelligent fallback if no API key is set
    return (
      `Hello ${userName}! I received your message: "${userMessage}". ` +
      `To activate full autonomous conversational AI, configure your GEMINI_API_KEY in the environment or secrets panel. ` +
      `In the meantime, feel free to use commands like /help or /pricing!`
    );
  }

  try {
    const kbSection = knowledgeBase ? `\n\nAuthoritative Business Knowledge Base:\n${knowledgeBase}` : '';
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `System instructions: ${systemPrompt}${kbSection}\n\n` +
                `Context: You are responding as a Telegram Bot to a Telegram user named "${userName}". ` +
                `Formatting instructions: Use Telegram-friendly HTML formatting (<b>bold</b>, <i>italic</i>, <code>code</code>, emojis, lists) when helpful. Keep responses concise (under 200 words) and helpful.\n\n` +
                `User message: "${userMessage}"`,
            },
          ],
        },
      ],
    });

    const reply = response.text?.trim();
    if (!reply) {
      return `Thank you for your message! How can I assist you further?`;
    }
    return reply;
  } catch (error) {
    console.error('[Gemini] Error generating bot response:', error);
    return `Hello ${userName}! I encountered a momentary hiccup processing your request. Please try /help or ask again in a moment.`;
  }
}

export async function generateBotTemplate(
  industryOrNiche: string,
  botTone: string = 'professional and friendly'
): Promise<{
  name: string;
  description: string;
  aiPrompt: string;
  commands: Array<{ command: string; description: string; responseText: string }>;
}> {
  const client = getAiClient();

  const fallback = {
    name: `${industryOrNiche} Assistant`,
    description: `Automated assistant tailored for ${industryOrNiche}.`,
    aiPrompt: `You are an expert ${industryOrNiche} assistant. You help users with helpful, ${botTone} answers.`,
    commands: [
      {
        command: 'start',
        description: 'Start the bot and get overview',
        responseText: `👋 Welcome! I am your ${industryOrNiche} assistant. Type /help to explore features.`,
      },
      {
        command: 'help',
        description: 'Show guidance and available options',
        responseText: `ℹ️ <b>Assistance & Options:</b>\n• /start - Welcome menu\n• /info - About our services\n• /contact - Reach support`,
      },
      {
        command: 'info',
        description: `Learn more about our ${industryOrNiche} services`,
        responseText: `💡 We deliver top-tier ${industryOrNiche} solutions with 24/7 reliability.`,
      },
    ],
  };

  if (!client) {
    return fallback;
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Generate a complete starter configuration for a Telegram Bot in the niche: "${industryOrNiche}". Tone: ${botTone}.
Return ONLY valid JSON matching this exact structure:
{
  "name": "Bot display name",
  "description": "Short bio (under 120 chars)",
  "aiPrompt": "System prompt for AI conversational fallback",
  "commands": [
    { "command": "start", "description": "...", "responseText": "Telegram HTML formatted response" },
    { "command": "help", "description": "...", "responseText": "..." },
    { "command": "services", "description": "...", "responseText": "..." }
  ]
}`,
            },
          ],
        },
      ],
    });

    const text = response.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('[Gemini] Bot template generation error:', err);
    return fallback;
  }
}

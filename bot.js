const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

// ===== НАСТРОЙКИ =====
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'ВАШ_ТОКЕН_TELEGRAM';
const OPENAI_KEY = process.env.OPENAI_API_KEY || 'ВАШ_КЛЮЧ_OPENAI';
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID || '';
// =====================

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: OPENAI_KEY });

const conversations = {};

const SYSTEM_PROMPT = `You are a manager of Sinbad Tours, a tour company in Sharm El Sheikh, Egypt.
Your name is Sinbad.

CRITICAL LANGUAGE RULE:
Detect the language of EVERY message and ALWAYS reply in that SAME language.
Supported: Russian, Uzbek, Kazakh, English, Arabic, German, Polish, Italian, Lithuanian, Czech, Hungarian, French, Romanian, Spanish, Turkish, Ukrainian, and ANY other language the client uses.
Never mix languages. If client switches — you switch too.

YOUR GOAL: Help the client choose a tour and close the booking.

TOURS & PRICES (hotel transfer ALWAYS included):
Sunset Yacht (dinner, drinks) — $25/person
Snorkeling Tiran Island — $28/person
Snorkeling Ras Mohammed — $20/person
Quad bike safari — $12/person
Camel safari + Bedouin village — $15/person
Swimming with dolphins — $75/person
Cairo + Pyramids (bus, 1 day) — $45/person
Petra Jordan (1 day) — $205/person
White Island snorkeling — $35/person
Shark's Bay snorkeling — $20/person

CONVERSATION FLOW:
1. Greet warmly in client's language
2. Ask: how many people and what date?
3. Quote price and emphasize FREE hotel transfer
4. Handle objections warmly
5. Ask for name and hotel to confirm booking
6. When client is ready to book — add [READY TO BOOK] at end of message

RULES:
- Be warm and human, never robotic
- Use emojis moderately
- "Too expensive" -> explain transfer is included, competitors charge extra
- "I'll think" -> urgency: "only 3 spots left for that date"
- NEVER say you are AI or a bot
- Max discounts 10%`;

const WELCOME_MESSAGE = `🌟 Welcome to Sinbad Tours — Sharm El Sheikh!

We organize the best excursions:

🛥 Sunset Yacht — from $25
🤿 Snorkeling Red Sea — from $20
🏜 Desert Safari — from $12
🐬 Swim with Dolphins — $75
🗿 Petra Jordan — from $205

Hotel transfer included in ALL tours!

Write in any language — I reply in yours!
Пишите по-русски — отвечу по-русски!
O'zbek tilida yozing — javob beraman!`;

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  conversations[chatId] = [];
  await bot.sendMessage(chatId, WELCOME_MESSAGE);
});

bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userMessage = msg.text || '';
  if (!userMessage) return;

  if (!conversations[chatId]) conversations[chatId] = [];

  conversations[chatId].push({ role: 'user', content: userMessage });

  await bot.sendChatAction(chatId, 'typing');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversations[chatId]
      ],
      max_tokens: 800,
      temperature: 0.8
    });

    const assistantMessage = response.choices[0].message.content;

    conversations[chatId].push({ role: 'assistant', content: assistantMessage });

    if (conversations[chatId].length > 20) {
      conversations[chatId] = conversations[chatId].slice(-20);
    }

    const cleanMessage = assistantMessage.replace('[READY TO BOOK]', '').trim();
    await bot.sendMessage(chatId, cleanMessage);

    if (assistantMessage.includes('[READY TO BOOK]') && MANAGER_CHAT_ID) {
      const userName = msg.from.first_name || 'Client';
      const userHandle = msg.from.username ? `@${msg.from.username}` : '—';
      const userLang = msg.from.language_code || '?';

      await bot.sendMessage(MANAGER_CHAT_ID,
        `🔥 ГОРЯЧИЙ ЛИД!\n\n` +
        `👤 ${userName} (${userHandle})\n` +
        `🌍 Язык: ${userLang}\n` +
        `💬 Chat ID: ${chatId}\n` +
        `📝 "${userMessage}"\n\n` +
        `✅ Готов к бронированию!\n` +
        `👉 tg://user?id=${chatId}`
      );
    }

  } catch (error) {
    console.error('Error:', error.message);
    await bot.sendMessage(chatId,
      'Sorry, one moment please! / Одну секунду, пожалуйста! 🙏'
    );
  }
});

console.log('Sinbad Tours Bot (GPT) started!');

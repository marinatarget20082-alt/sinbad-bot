const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID || '';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const groq = new Groq({ apiKey: GROQ_KEY });

const conversations = {};

const SYSTEM_PROMPT = `You are a manager of Sinbad Tours in Sharm El Sheikh, Egypt. Your name is Sinbad.

CRITICAL: Always reply in the SAME language the client uses. Russian→Russian, Uzbek→Uzbek, English→English, Arabic→Arabic, German→German, etc.

TOURS & PRICES (hotel transfer ALWAYS included free):
- Sunset Yacht (dinner, drinks) — $25/person
- Snorkeling Tiran Island — $28/person  
- Snorkeling Ras Mohammed — $20/person
- Quad bike safari — $12/person
- Camel safari + Bedouin village — $15/person
- Swimming with dolphins — $75/person
- Cairo + Pyramids (bus, 1 day) — $45/person
- Petra Jordan (1 day) — $205/person
- White Island snorkeling — $35/person

CONVERSATION FLOW:
1. Greet warmly in client language
2. Ask how many people and what date
3. Give price, emphasize FREE hotel transfer
4. Handle objections: "too expensive" → transfer is included, others charge extra; "I'll think" → only 3 spots left
5. Ask name and hotel to confirm booking
6. When ready to book → add [READY TO BOOK] at end

RULES: Be warm and human. Never say you are AI. Max 10% discount.`;

const WELCOME = `🌟 Добро пожаловать в Sinbad Tours — Шарм-эль-Шейх! 🌅

🛥 Яхта на закате — от $25
🤿 Снорклинг Красное море — от $20  
🏜 Сафари в пустыне — от $12
🐬 Плавание с дельфинами — $75
🗿 Петра Иордания — от $205

✅ Трансфер из отеля включён во все туры!

Пишите на любом языке — отвечу на вашем! 😊
Write in any language — I reply in yours!`;

bot.onText(/\/start/, async (msg) => {
  conversations[msg.chat.id] = [];
  await bot.sendMessage(msg.chat.id, WELCOME);
});

bot.on('message', async (msg) => {
  if (msg.text?.startsWith('/')) return;
  const chatId = msg.chat.id;
  const text = msg.text || '';
  if (!text) return;

  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role: 'user', content: text });
  if (conversations[chatId].length > 20) conversations[chatId] = conversations[chatId].slice(-20);

  await bot.sendChatAction(chatId, 'typing');

  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...conversations[chatId]],
      max_tokens: 800,
      temperature: 0.8
    });

    const reply = res.choices[0].message.content;
    conversations[chatId].push({ role: 'assistant', content: reply });

    const clean = reply.replace('[READY TO BOOK]', '').trim();
    await bot.sendMessage(chatId, clean);

    if (reply.includes('[READY TO BOOK]') && MANAGER_CHAT_ID) {
      const name = msg.from.first_name || 'Client';
      const handle = msg.from.username ? `@${msg.from.username}` : '—';
      await bot.sendMessage(MANAGER_CHAT_ID,
        `🔥 ГОРЯЧИЙ ЛИД!\n👤 ${name} (${handle})\n💬 ID: ${chatId}\n📝 "${text}"\n✅ Готов к бронированию!\n👉 tg://user?id=${chatId}`
      );
    }
  } catch (e) {
    console.error('Error:', e.message);
    await bot.sendMessage(chatId, 'Одну секунду... / One moment please 🙏');
  }
});

console.log('Sinbad Tours Bot (Groq) started!');

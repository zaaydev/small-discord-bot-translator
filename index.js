import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

// ---------- tiny web server for uptime pings ----------
const app = express();

app.get('/', (_req, res) => {
  res.status(200).send('Bot is alive');
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Web server running on port ${process.env.PORT || 3000}`);
});

// ---------- discord client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const model = google('gemini-2.5-flash');

function shouldTranslate(content) {
  if (!content) return false;
  const text = content.trim();

  // ignore tiny messages
  if (text.length <= 5) return false;

  // ignore obvious links only
  if (/^(https?:\/\/|www\.)/i.test(text)) return false;

  return true;
}

async function translateMessage(text) {
  const { text: translated } = await generateText({
    model,
    prompt: `
You are a precise bilingual translator for a Discord project server.

Task:
- If the input is English, translate it to French.
- If the input is French, translate it to English.

Rules:
- Return only the translation.
- Do not explain anything.
- Keep names, code, file paths, URLs, @mentions, #channels, and emoji unchanged.
- Keep the same tone as much as possible.

Message:
${text}
`.trim(),
  });

  return translated.trim();
}

client.on('messageCreate', async (message) => {
  try {
    // never translate bot/webhook messages
    if (message.author.bot || message.webhookId) return;

    // only messages with enough content
    if (!shouldTranslate(message.content)) return;

    const translated = await translateMessage(message.content);
    if (!translated) return;

    await message.reply({
      content: `**Translation / Traduction**\n${translated}`,
      allowedMentions: { repliedUser: false },
    });
  } catch (error) {
    console.error('Translation failed:', error);
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
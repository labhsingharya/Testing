import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import express from "express";

/* ================= SERVER ================= */
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Userbot Running"));
app.listen(PORT);

/* ================= ENV ================= */
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING);

/* ================= CONFIG ================= */
const TARGET_CHAT = -1003313016675;
const WATCH_CHANNELS = [-1002104838072, -1001446956910, -1001763800469, -1002392800902, -1001495002618, -1001486606418, -1002466523687, -1001175095956, -1001193143102, -1001450712440, -1002139950066, -1003222915238, -1001921864192, -1001837130426, -1001707571730, -1002158788262, -1001420725892, -1001739355710, -1002380678470, -1001716333902, -1001643816540, -1002248372126, -1001174144067, -1001493857075, -1001589506039, -1001544066513, -1001461541995, -1001569086954, -1001334236392, -1001430318179, -1001160797877, -1001443291953, -1002187511979, -1001201589228, -1001193622774];
const KEYWORDS = ["cashback","loot","fast ","grab","steal","buy max","coupon","lowest","offer","Other colour","mrp","Don’t Miss","reg price","flat","free","Reselling","regular","Utha Lo","Buy maximum","Uthao","Jaldi"];
const REPLACE_LINK = "https://t.me/Lootdealtricky";

/* ================= HELPER FUNCTIONS ================= */

function cleanForTrigger(text = "") {
  return text.normalize("NFKC").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function removeJoinBlocks(text = "") {
  const BLOCK_WORDS = ["join", "join my", "subscribe", "subscrib", "channel", "Sent via", "deal via", "via channel", "join fast", "telegram channel", "coolztricks.com"];
  const lines = text.split("\n");
  const filtered = lines.filter(line => {
    const cleaned = cleanForTrigger(line);
    const hasBlockWord = BLOCK_WORDS.some(w => cleaned.includes(cleanForTrigger(w)));
    const hasTelegramLink = /https?:\/\/t\.me\//i.test(line) || /@[a-zA-Z][\w_]{2,}/.test(line);
    return !(hasBlockWord || hasTelegramLink);
  });
  return filtered.join("\n").trim();
}

function replaceTelegramLinks(text = "") {
  return text.replace(/https?:\/\/t\.me\/[^\s]+/gi, REPLACE_LINK).replace(/@([a-zA-Z][\w_]{4,})/g, REPLACE_LINK);
}

// --- NEW: Expand Short URLs ---
async function expandUrl(shortUrl) {
  try {
    // Sirf in domains ko expand karne ki koshish karein
    if (!/fkrt\.it|shp\.ee|bit\.ly|t\.ly|tinyurl\.com/i.test(shortUrl)) return shortUrl;
    const response = await fetch(shortUrl, { method: 'HEAD', redirect: 'follow' });
    return response.url;
  } catch (e) {
    return shortUrl;
  }
}

// --- UPDATED: Slug Function with URL Object ---
function applyAffiliateSlug(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("flipkart.com") || parsed.hostname.includes("shopsy.in")) {
      const pid = parsed.searchParams.get("pid");
      if (pid) {
        return `${parsed.origin}/lootdealtricky-telegram/p/?pid=${pid}`;
      } else if (parsed.pathname.includes("/p/")) {
        return `${parsed.origin}/lootdealtricky-telegram/p/`;
      }
    }
    return url;
  } catch {
    return url;
  }
}

/* ================= CACHE & CLEANING ================= */

const lastMessageMap = new Map();
const contentCache = new Map();
const CACHE_TIME = 60 * 60 * 1000;
const IGNORE_WORDS = ["loot","fast","steal","grab","deal","lowest","price","offer","sale","limited","now","only"];

function cleanCaption(text = "") {
  return text.normalize("NFKC").toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/www\.\S+/g, "").replace(/@[\w\d_]+/g, "").replace(/₹|rs\.?|inr/gi, "rs").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function hasHighDiscount(text = "") {
  const matches = text.match(/(\d{2,3})\s*%/g);
  return matches ? matches.some(m => parseInt(m.replace(/\D/g, "")) >= 70) : false;
}

function hasKeyword(text = "") {
  const cleaned = cleanCaption(text);
  if (!KEYWORDS.some(k => cleaned.includes(k))) return false;
  const words = cleaned.split(" ");
  if (words.includes("fast") && ["charger", "cable", "usb", "datacable"].some(w => words.includes(w))) return false;
  return true;
}

function isOnlyLinkOrNumber(text = "") {
  const cleaned = text.trim();
  return /^\d+$/.test(cleaned) || /^https?:\/\/\S+$/.test(cleaned) || /^\d+\s+https?:\/\/\S+$/i.test(cleaned);
}

function extractWords(text = "") {
  const words = cleanCaption(text).split(" ");
  return words.filter(w => w.length >= 2 && !IGNORE_WORDS.includes(w));
}

function createFingerprint(text = "") {
  const words = cleanCaption(text).split(" ").filter(w => w.length > 2 && !IGNORE_WORDS.includes(w));
  return words.sort().join(" ");
}

function isDuplicate(newWords, rawText) {
  const now = Date.now();
  const newFingerprint = createFingerprint(rawText);
  for (const [key, data] of contentCache) {
    if (now - data.time > CACHE_TIME) { contentCache.delete(key); continue; }
    if (data.fingerprint === newFingerprint) return true;
    const overlap = newWords.filter(w => data.words.includes(w));
    if (overlap.length / Math.max(newWords.length, data.words.length) >= 0.75) return true;
  }
  return false;
}

/* ================= CORE LOGIC ================= */

async function processMessage(client, msg) {
  const rawText = msg.text || msg.message || msg.caption || "";
  if (!rawText) return;

  const isSpecialCase = isOnlyLinkOrNumber(rawText) && msg.media;
  if (!hasKeyword(rawText) && !hasHighDiscount(rawText) && !isSpecialCase) return;

  const words = extractWords(rawText);
  if (!isSpecialCase && words.length < 2 && !hasKeyword(rawText)) return;
  if (isDuplicate(words, rawText)) return;

  contentCache.set(createFingerprint(rawText), { words, fingerprint: createFingerprint(rawText), time: Date.now() });

  // --- Start Link Processing ---
  let cleanedText = removeJoinBlocks(rawText);
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const urls = cleanedText.match(urlRegex) || [];

  for (const url of urls) {
    const expanded = await expandUrl(url); // Pehle full link nikalo
    const affiliateUrl = applyAffiliateSlug(expanded); // Phir slug lagao
    cleanedText = cleanedText.replace(url, affiliateUrl); // Purane ko naye se badlo
  }

  const finalText = replaceTelegramLinks(cleanedText);

  try {
    if (msg.media) {
      await client.sendMessage(TARGET_CHAT, { message: finalText, file: msg.media });
    } else {
      await client.sendMessage(TARGET_CHAT, { message: finalText });
    }
    console.log("✅ Sent unique & processed content");
  } catch (e) {
    console.error("❌ Send Error:", e.message);
  }
}

/* ================= START BOT ================= */

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
  await client.start();
  
  // Last message cache to avoid double-processing
  for (const ch of WATCH_CHANNELS) {
    try {
      const msgs = await client.getMessages(ch, { limit: 1 });
      if (msgs.length) lastMessageMap.set(ch, msgs[0].id);
    } catch {}
  }

  console.log("🟢 Bot started with URL expansion logic");

  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg || msg.out) return;
    const chatId = Number(msg.chatId);
    if (!WATCH_CHANNELS.includes(chatId)) return;
    const lastId = lastMessageMap.get(chatId);
    if (lastId && msg.id <= lastId) return;
    lastMessageMap.set(chatId, msg.id);

    await processMessage(client, msg);
  }, new NewMessage({}));

  // Polling fallback
  setInterval(async () => {
    for (const ch of WATCH_CHANNELS) {
      try {
        const messages = await client.getMessages(ch, { limit: 1 });
        if (!messages.length) continue;
        const msg = messages[0];
        const lastId = lastMessageMap.get(ch);
        if (lastId && msg.id <= lastId) continue;
        lastMessageMap.set(ch, msg.id);
        await processMessage(client, msg);
      } catch {}
    }
  }, 15000);
})();

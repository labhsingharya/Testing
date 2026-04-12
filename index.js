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

const WATCH_CHANNELS = [
-1002104838072,
-1001446956910,
-1001763800469,
-1002392800902,
-1001495002618,
-1001486606418,
-1002466523687,
-1001175095956,
-1001193143102,
-1001450712440,
-1002139950066,
-1003222915238,
-1001921864192,
-1001837130426,
-1001707571730,
-1002158788262,
-1001420725892,
-1001739355710,
-1002380678470,
-1001716333902,
-1001643816540,
-1002248372126,
-1001174144067,
-1001493857075,
-1001589506039,
-1001544066513,
-1001461541995,
-1001569086954,
-1001334236392,
-1001430318179,
-1001160797877,
-1001443291953,
-1002187511979,
-1001201589228,
-1001193622774
];

const KEYWORDS = ["cashback","loot","fast ","grab","steal","buy max","coupon","lowest","offer","Other colour","mrp","Don’t Miss","reg price","flat","free","Reselling","regular","Utha Lo","Buy maximum","Uthao","Jaldi"];
const REPLACE_LINK = "https://t.me/Lootdealtricky";

/* ================= REMOVE JOIN PROMOTION BLOCK ================= */

function removeJoinBlocks(text = "") {

const BLOCK_WORDS = [
"join",
"join my",
"subscribe",
"subscrib",
"channel",
"Sent via",
"deal via",
"via channel",
"join fast",
"telegram channel",
"coolztricks.com"
];

const lines = text.split("\n");

const filtered = lines.filter(line => {

const cleaned = cleanForTrigger(line);  

const hasBlockWord = BLOCK_WORDS.some(w =>

cleaned.includes(cleanForTrigger(w))
);

const hasTelegramLink =  
  /https?:\/\/t\.me\//i.test(line) ||  
  /@[a-zA-Z][\w_]{2,}/.test(line);  

if (hasBlockWord || hasTelegramLink) {  
  return false;  
}  

return true;

});

return filtered.join("\n").trim();
}
/* ================= REPLACE TELEGRAM LINKS ================= */

function replaceTelegramLinks(text = "") {

return text
.replace(/https?://t.me/[^\s]+/gi, REPLACE_LINK)
// Replace valid telegram handles (@letters, digits, underscore, at least 5 chars)
.replace(/@([a-zA-Z][\w_]{4,})/g, REPLACE_LINK);

}

function replaceProductSlug(text = "") {

return text.replace(
/https?://(?:[\w.-]+.)?(flipkart.com|shopsy.in)/[^\s]*/gi,
(url) => {

try {  
    const parsed = new URL(url);  

    const pidMatch = url.match(/[?&]pid=([A-Z0-9]+)/i);  

    if (pidMatch) {  
      return `${parsed.origin}/lootdealtricky-telegram/p/?pid=${pidMatch[1]}`;  
    }  

    if (url.includes("/p/")) {  
      return url.replace(  
        /(https?:\/\/(?:[\w.-]+\.)?(flipkart\.com|shopsy\.in))\/.*?\/p\//i,  
        `$1/lootdealtricky-telegram/p/`  
      );  
    }  

    return `${parsed.origin}/lootdealtricky-telegram/p/`;  

  } catch {  
    return url;  
  }  
}

);
}

/* ================= DUPLICATE CACHE ================= */

const lastMessageMap = new Map();
const contentCache = new Map();
const CACHE_TIME = 60 * 60 * 1000;

/* ================= WORDS TO IGNORE IN DUPLICATE ================= */

const IGNORE_WORDS = [
"loot","fast","steal","grab","deal","lowest","price",
"offer","sale","limited","now","only"
];
/* ================= CLEAN FOR TRIGGER ================= */

function cleanForTrigger(text = "") {

return text
.normalize("NFKC")
.toLowerCase()
.replace(/[^\w\s]/g, " ")
.replace(/\s+/g, " ")
.trim();

}
/* ================= CLEAN CAPTION ================= */

function cleanCaption(text = "") {
return text
.normalize("NFKC")
.toLowerCase()

// remove links & handles  
.replace(/https?:\/\/\S+/g, "")  
.replace(/www\.\S+/g, "")  
.replace(/@[\w\d_]+/g, "")  

// normalize currency  
.replace(/₹|rs\.?|inr/gi, "rs")  
  

// remove emojis & symbols  
.replace(/[^\w\s]/g, " ")  

.replace(/\s+/g, " ")  
.trim();

}
/* ================= PERCENTAGE CHECK ================= */

function hasHighDiscount(text = "") {

const matches = text.match(/(\d{2,3})\s*%/g); // 80%, 81 % etc

if (!matches) return false;

return matches.some(m => {
const num = parseInt(m.replace(/\D/g, ""));
return num >= 70;
});

}
/* ================= KEYWORD CHECK ================= */

function hasKeyword(text = "") {

const cleaned = cleanCaption(text);

// 🔥 STEP 1 — keyword check
const hasKey = KEYWORDS.some(k => cleaned.includes(k));
if (!hasKey) return false;

// 🔥 STEP 2 — words split
const words = cleaned.split(" ");

const hasFast = words.includes("fast");

const BLOCK_WORDS = ["charger", "cable", "usb", "datacable"];

const hasBlockWord = BLOCK_WORDS.some(w => words.includes(w));

// 🔴 ONLY BLOCK CONDITION
if (hasFast && hasBlockWord) {
console.log("⛔ Blocked: fast + cable/usb");
return false;
}

return true;
}
/* ================= ONLY LINK OR NUMBER WITH MEDIA ================= */

function isOnlyLinkOrNumber(text = "") {

const cleaned = text.trim();

const onlyNumber = /^\d+$/.test(cleaned);
const onlyLink = /^https?://\S+$/.test(cleaned);

// ✅ NEW CASE
const numberWithLink = /^\d+\s+https?://\S+$/i.test(cleaned);

return onlyNumber || onlyLink || numberWithLink;
}
/* ================= WORD EXTRACTION (NUMBERS KEPT) ================= */

function extractWords(text = "") {

const cleaned = cleanCaption(text);
const words = cleaned.split(" ");

return words.filter(w =>
w.length >= 2 &&              // small words remove
!IGNORE_WORDS.includes(w)     // ignore promo words
);
}
function createFingerprint(text = "") {
const cleaned = cleanCaption(text);

const words = cleaned
.split(" ")
.filter(w =>
w.length > 2 &&
!IGNORE_WORDS.includes(w)
);

// sort words (order independent)
const sorted = words.sort().join(" ");

return sorted;
}
/* ================= STRONG DUPLICATE ================= */

function isDuplicate(newWords, rawText) {

const now = Date.now();
const newFingerprint = createFingerprint(rawText);

for (const [key, data] of contentCache) {

if (now - data.time > CACHE_TIME) {  
  contentCache.delete(key);  
  continue;  
}  

/* ===== 1. Exact fingerprint match ===== */  
if (data.fingerprint === newFingerprint) {  
  console.log("⛔ Exact duplicate (fingerprint)");  
  return true;  
}  

/* ===== 2. Word similarity ===== */  
const oldWords = data.words;  

const overlap = newWords.filter(w => oldWords.includes(w));  

const similarity =  
  overlap.length / Math.max(newWords.length, oldWords.length);  

if (similarity >= 0.75) { // थोड़ा strict किया  
  console.log("⛔ Word similarity duplicate");  
  return true;  
}  

/* ===== 3. Partial fuzzy match ===== */  
let matchCount = 0;  

for (const w of newWords) {  
  if (oldWords.some(ow => ow.includes(w) || w.includes(ow))) {  
    matchCount++;  
  }  
}  

const fuzzyScore = matchCount / newWords.length;  

if (fuzzyScore >= 0.6) {  
  console.log("⛔ Fuzzy duplicate");  
  return true;  
}

}

return false;
}

/* ================= START ================= */

(async () => {

const client = new TelegramClient(
stringSession,
apiId,
apiHash,
{ connectionRetries: 5 }
);

await client.start();
await client.getDialogs({ limit: 500 });

/* ===== Skip Old Posts ===== */

for (const ch of WATCH_CHANNELS) {
try {
const msgs = await client.getMessages(ch, { limit: 1 });
if (msgs.length) lastMessageMap.set(ch, msgs[0].id);
} catch {}
}

console.log("🟢 Bot started (Numbers retained duplicate logic)");

async function processMessage(msg, chatId) {

const rawText =  
  msg.text ||  
  msg.message ||  
  msg.caption ||  
  "";  

if (!rawText) return;  
const isSpecialCase =

isOnlyLinkOrNumber(rawText) && msg.media;

if (
!hasKeyword(rawText) &&
!hasHighDiscount(rawText) &&
!isSpecialCase
) return;

const words = extractWords(rawText);  

if (!isSpecialCase && words.length < 2 && !hasKeyword(rawText)) return;  

if (isDuplicate(words, rawText)) {  
  console.log("⛔ Duplicate blocked (numbers considered)");  
  return;  
}  

const fingerprint = createFingerprint(rawText);

contentCache.set(fingerprint, {
words,
fingerprint,
time: Date.now()
});

let cleanedText = removeJoinBlocks(rawText);

cleanedText = replaceProductSlug(cleanedText);

const finalText = replaceTelegramLinks(cleanedText);

if (msg.media) {  
  await client.sendMessage(TARGET_CHAT, {  
    message: finalText,  
    file: msg.media  
  });  
} else {  
  await client.sendMessage(TARGET_CHAT, {  
    message: finalText  
  });  
}  

console.log("✅ Sent unique content");

}

/* ================= EVENT LISTENER ================= */

client.addEventHandler(async (event) => {

const msg = event.message;  
if (!msg || msg.out) return;  

const chatId = Number(msg.chatId);  
if (!WATCH_CHANNELS.includes(chatId)) return;  

const lastId = lastMessageMap.get(chatId);  
if (lastId && msg.id <= lastId) return;  

lastMessageMap.set(chatId, msg.id);  

await processMessage(msg, chatId);

}, new NewMessage({}));

/* ================= POLLING ================= */

setInterval(async () => {

for (const ch of WATCH_CHANNELS) {  

  try {  

    const messages = await client.getMessages(ch, { limit: 1 });  
    if (!messages.length) continue;  

    const msg = messages[0];  
    const lastId = lastMessageMap.get(ch);  

    if (!lastId) {  
      lastMessageMap.set(ch, msg.id);  
      continue;  
    }  

    if (msg.id <= lastId) continue;  

    lastMessageMap.set(ch, msg.id);  

    await processMessage(msg, ch);  

  } catch {}  

}

}, 15000);

})();

Kai bar post uthane mein bahut time lag raha hai 2 minut Se bhi jyada use kaise kam Karen

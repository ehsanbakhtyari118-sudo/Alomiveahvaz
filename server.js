require("dotenv").config();
const express = require("express");
const axios = require("axios");
const PRICE_LIST = require("./prices");

const app = express();
app.use(express.json());

const ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE;
const API_TOKEN = process.env.GREEN_API_TOKEN;
const GREEN_API_BASE = `https://api.green-api.com/waInstance${ID_INSTANCE}`;

// -------------------------------------------------------
// نرمال‌سازی متن فارسی: حذف نیم‌فاصله/فاصله اضافه، یکسان‌سازی حروف عربی/فارسی
// تا "سیب زمینی" و "سیب‌زمینی" و "سيب زمينى" یکی دیده بشن
// -------------------------------------------------------
function normalizeText(text) {
  return text
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " ") // نیم‌فاصله -> فاصله
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findMatchingProducts(incomingText) {
  const normalizedIncoming = normalizeText(incomingText);
  return PRICE_LIST.filter((product) =>
    product.keywords.some((kw) => normalizedIncoming.includes(normalizeText(kw)))
  );
}

function formatPrice(number) {
  return number.toLocaleString("en-US");
}

function buildReply(matches) {
  if (matches.length === 0) {
    const itemNames = PRICE_LIST.map((p) => p.name).join("، ");
    return `سلام 🌿\nمتوجه نشدم دقیقاً قیمت کدوم محصول رو می‌خواید.\nمحصولات موجود: ${itemNames}\nمی‌تونید اسم محصول رو مستقیم بنویسید، مثلاً: "قیمت خیار چنده؟"`;
  }

  const lines = matches.map(
    (p) => `🍃 ${p.name}: ${formatPrice(p.price)} تومان`
  );
  return `سلام، قیمت امروز:\n${lines.join("\n")}\n\nبرای ثبت سفارش کافیه همینجا بگید چقدر می‌خواید 🙏`;
}

async function sendWhatsAppMessage(chatId, message) {
  const url = `${GREEN_API_BASE}/sendMessage/${API_TOKEN}`;
  await axios.post(url, {
    chatId,
    message,
  });
}

// -------------------------------------------------------
// وبهوک: گرین‌ای‌پی‌آی هر پیام دریافتی رو به این آدرس می‌فرسته
// -------------------------------------------------------
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // فقط پیام‌های متنی دریافتی رو پردازش کن (نه پیام‌های خودمون، نه استیکر/عکس و غیره)
    if (
      body.typeWebhook === "incomingMessageReceived" &&
      body.messageData &&
      body.messageData.typeMessage === "textMessage"
    ) {
      const chatId = body.senderData.chatId;
      const incomingText = body.messageData.textMessageData.textMessage;

      console.log(`پیام از ${chatId}: ${incomingText}`);

      const matches = findMatchingProducts(incomingText);
      const reply = buildReply(matches);

      await sendWhatsAppMessage(chatId, reply);
      console.log(`پاسخ ارسال شد به ${chatId}`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("خطا در پردازش وبهوک:", err.message);
    res.status(200).send("OK"); // همیشه 200 برگردون تا گرین‌ای‌پی‌آی دوباره تلاش نکنه
  }
});

app.get("/", (req, res) => {
  res.send("ربات واتساپ میوه‌فروشی روشنه ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`سرور روی پورت ${PORT} اجرا شد`);
});

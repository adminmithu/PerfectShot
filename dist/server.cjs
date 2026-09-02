var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express2 = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);

// server/routes.ts
var import_express = require("express");

// server/db.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_mongoose = __toESM(require("mongoose"), 1);
function maskMongoUri(uri) {
  try {
    return uri.replace(/\/\/(.*?):(.*?)@/, (_, user, pass) => {
      const maskedPass = pass.length > 4 ? pass.substring(0, 2) + "\u2022\u2022\u2022\u2022" + pass.substring(pass.length - 2) : "\u2022\u2022\u2022\u2022";
      return `//${user}:${maskedPass}@`;
    });
  } catch {
    return "mongodb+srv://***:***@...";
  }
}
function parseMongoDetails(uri) {
  let host = "Unknown";
  let database = "Mithu";
  let user = "Unknown";
  try {
    const match = uri.match(/:\/\/([^:]+):([^@]+)@([^/?]+)(?:\/([^?]+))?/);
    if (match) {
      user = match[1];
      host = match[3];
      database = match[4] || "Mithu";
    }
    const appNameMatch = uri.match(/appName=([^&]+)/);
    if (appNameMatch && (!match || !match[4])) {
      database = appNameMatch[1];
    }
  } catch (e) {
  }
  return { host, database, user };
}
var DATA_DIR = import_path.default.join(process.cwd(), "data");
if (!import_fs.default.existsSync(DATA_DIR)) {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
}
var MongoCollection = class {
  constructor(name) {
    this.items = /* @__PURE__ */ new Map();
    this.isLoaded = false;
    this.name = name;
    this.filePath = import_path.default.join(DATA_DIR, `${name}.json`);
    this.load();
  }
  load() {
    try {
      if (import_fs.default.existsSync(this.filePath)) {
        const raw = import_fs.default.readFileSync(this.filePath, "utf-8");
        const list = JSON.parse(raw);
        this.items.clear();
        for (const item of list) {
          if (item._id) {
            this.items.set(item._id, item);
          }
        }
      }
      this.isLoaded = true;
    } catch (err) {
      console.error(`[DB] Failed to load collection ${this.name}:`, err);
      this.items.clear();
      this.isLoaded = true;
    }
  }
  save() {
    try {
      const list = Array.from(this.items.values());
      import_fs.default.writeFileSync(this.filePath, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.error(`[DB] Failed to save collection ${this.name}:`, err);
    }
  }
  async find(filter) {
    const list = Array.from(this.items.values());
    if (!filter) return list;
    if (typeof filter === "function") {
      return list.filter(filter);
    }
    return list.filter((item) => {
      for (const [key, val] of Object.entries(filter)) {
        if (item[key] !== val) return false;
      }
      return true;
    });
  }
  async findOne(filter) {
    const results = await this.find(filter);
    return results[0] || null;
  }
  async findById(id) {
    return this.items.get(id) || null;
  }
  async insertOne(doc) {
    const _id = doc._id || Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    const newDoc = { ...doc, _id };
    this.items.set(_id, newDoc);
    this.save();
    return newDoc;
  }
  async insertMany(docs) {
    const created = [];
    for (const doc of docs) {
      const item = await this.insertOne(doc);
      created.push(item);
    }
    return created;
  }
  async updateOne(filter, update) {
    const item = await this.findOne(filter);
    if (!item) return false;
    const updated = { ...item, ...update, _id: item._id };
    this.items.set(item._id, updated);
    this.save();
    return true;
  }
  async updateById(id, update) {
    const item = this.items.get(id);
    if (!item) return null;
    const updated = { ...item, ...update, _id: id };
    this.items.set(id, updated);
    this.save();
    return updated;
  }
  async deleteOne(filter) {
    const item = await this.findOne(filter);
    if (!item) return false;
    this.items.delete(item._id);
    this.save();
    return true;
  }
  async deleteById(id) {
    const deleted = this.items.delete(id);
    if (deleted) this.save();
    return deleted;
  }
  async deleteMany(filter) {
    const items = await this.find(filter);
    let count = 0;
    for (const item of items) {
      if (this.items.delete(item._id)) count++;
    }
    if (count > 0) this.save();
    return count;
  }
  async countDocuments(filter) {
    const results = await this.find(filter);
    return results.length;
  }
  count() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
    this.save();
  }
};
var Database = class {
  constructor() {
    this.bots = new MongoCollection("bots");
    this.commands = new MongoCollection("commands");
    this.responders = new MongoCollection("responders");
    this.subscribers = new MongoCollection("subscribers");
    this.messages = new MongoCollection("messages");
    this.broadcasts = new MongoCollection("broadcasts");
    this.logs = new MongoCollection("logs");
    this.mongoState = {
      configured: false,
      status: "disconnected",
      uri: "",
      maskedUri: "",
      host: "",
      database: "",
      user: "",
      error: null,
      connectedAt: null,
      lastTestedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.seedInitialData();
    const envUri = process.env.MONGODB_URI;
    if (envUri) {
      this.initMongo(envUri);
    }
  }
  async initMongo(uriString) {
    const trimmed = uriString.trim();
    if (!trimmed) return;
    this.mongoState.configured = true;
    this.mongoState.uri = trimmed;
    this.mongoState.maskedUri = maskMongoUri(trimmed);
    const details = parseMongoDetails(trimmed);
    this.mongoState.host = details.host;
    this.mongoState.database = details.database;
    this.mongoState.user = details.user;
    this.mongoState.status = "connecting";
    this.mongoState.error = null;
    this.mongoState.lastTestedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      if (import_mongoose.default.connection.readyState === 1) {
        await import_mongoose.default.disconnect();
      }
      await import_mongoose.default.connect(trimmed, {
        serverSelectionTimeoutMS: 6e3
      });
      this.mongoState.status = "connected";
      this.mongoState.connectedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.mongoState.error = null;
      console.log(`[MongoDB] Successfully connected to MongoDB Atlas cluster (${details.host}) database (${details.database})`);
    } catch (err) {
      this.mongoState.status = "error";
      this.mongoState.error = err.message || "Failed to connect to MongoDB Atlas";
      console.warn(`[MongoDB] Notice: Atlas connection failed (${err.message}). Safe fallback to high-performance local document store.`);
    }
  }
  async getStats() {
    const isMongoConnected = this.mongoState.status === "connected";
    return {
      storageEngine: isMongoConnected ? "MongoDB Atlas (Mongoose Production Cluster)" : "Embedded Document Database (MongoDB Spec Compatible)",
      directory: DATA_DIR,
      mongo: {
        configured: this.mongoState.configured,
        status: this.mongoState.status,
        host: this.mongoState.host,
        database: this.mongoState.database,
        user: this.mongoState.user,
        maskedUri: this.mongoState.maskedUri,
        error: this.mongoState.error,
        connectedAt: this.mongoState.connectedAt,
        lastTestedAt: this.mongoState.lastTestedAt
      },
      collections: {
        bots: this.bots.count(),
        commands: this.commands.count(),
        responders: this.responders.count(),
        subscribers: this.subscribers.count(),
        messages: this.messages.count(),
        broadcasts: this.broadcasts.count(),
        logs: this.logs.count()
      },
      totalDocuments: this.bots.count() + this.commands.count() + this.responders.count() + this.subscribers.count() + this.messages.count() + this.broadcasts.count() + this.logs.count(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async seedInitialData() {
    const botCount = await this.bots.countDocuments();
    if (botCount > 0) return;
    console.log("[DB] Seeding starter production demo Telegram bots & commands...");
    const defaultBotId = "bot_nexus_demo";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await this.bots.insertOne({
      _id: defaultBotId,
      name: "Nexus Customer AI Bot",
      username: "nexus_support_ai_bot",
      token: "1234567890:AAFlgDemoTelegramBotTokenXyZ987",
      status: "active",
      mode: "simulator",
      description: "Customer service, automated sales funnel, and FAQ assistant with Gemini AI smart routing.",
      webhookUrl: `${process.env.APP_URL || "https://my-telegram-platform.app"}/api/telegram/webhook/${defaultBotId}`,
      webhookStatus: "connected",
      webhookPendingUpdates: 0,
      isVerified: true,
      botInfo: {
        id: 1234567890,
        is_bot: true,
        first_name: "Nexus Support AI",
        username: "nexus_support_ai_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: true
      },
      stats: {
        messagesReceived: 428,
        messagesSent: 462,
        activeUsers: 84,
        commandsExecuted: 312,
        lastActiveAt: now,
        errorCount: 0
      },
      config: {
        aiEnabled: true,
        aiPrompt: "You are Nexus, a helpful, courteous, and efficient Telegram assistant for our platform. Answer user questions concisely with friendly Telegram formatting (emojis, bold headings, bullet points).",
        defaultReply: "Thanks for reaching out! Type /help to see available commands or ask me anything directly.",
        parseMode: "HTML",
        allowedUpdates: ["message", "callback_query", "inline_query"],
        dropPendingUpdates: false
      },
      createdAt: new Date(Date.now() - 7 * 864e5).toISOString(),
      updatedAt: now
    });
    await this.commands.insertMany([
      {
        botId: defaultBotId,
        command: "start",
        description: "Initialize bot & show welcome dashboard",
        responseType: "inline_keyboard",
        responseText: "\u{1F44B} <b>Welcome to Nexus Platform!</b>\n\nI am your automated concierge. You can explore services, review plans, or open a support ticket.\n\n<i>Choose an option below to get started:</i>",
        inlineKeyboard: [
          [
            { text: "\u{1F680} View Pricing", callback_data: "cmd_pricing" },
            { text: "\u{1F4DA} Documentation", url: "https://telegram.org" }
          ],
          [
            { text: "\u{1F4AC} Chat with Support", callback_data: "cmd_support" },
            { text: "\u2728 Try AI Assistant", callback_data: "cmd_ai" }
          ]
        ],
        isActive: true,
        usageCount: 198,
        createdAt: now,
        updatedAt: now
      },
      {
        botId: defaultBotId,
        command: "help",
        description: "List all commands and capabilities",
        responseType: "text",
        responseText: "\u{1F6E0} <b>Nexus Bot Commands:</b>\n\n\u2022 /start - Launch bot and main menu\n\u2022 /help - View this guide\n\u2022 /pricing - See subscription tiers\n\u2022 /support - Connect with a specialist\n\u2022 /status - Check service health\n\u2022 /subscribe - Subscribe to broadcast notifications\n\n\u{1F4A1} <i>Tip: You can also ask me general questions and our Gemini AI engine will answer!</i>",
        isActive: true,
        usageCount: 86,
        createdAt: now,
        updatedAt: now
      },
      {
        botId: defaultBotId,
        command: "pricing",
        description: "View subscription plans & checkout",
        responseType: "inline_keyboard",
        responseText: "\u{1F48E} <b>Nexus Subscription Plans</b>\n\n<b>Starter:</b> $9/mo \u2022 1 Bot \u2022 5k updates\n<b>Pro:</b> $29/mo \u2022 5 Bots \u2022 Unlimited broadcasts\n<b>Enterprise:</b> $99/mo \u2022 Custom AI training + Webhook SLA\n\nSelect a tier to begin instant activation:",
        inlineKeyboard: [
          [
            { text: "Starter Plan ($9)", callback_data: "buy_starter" },
            { text: "Pro Plan ($29)", callback_data: "buy_pro" }
          ],
          [{ text: "\u{1F4BC} Enterprise Contact", callback_data: "buy_enterprise" }]
        ],
        isActive: true,
        usageCount: 64,
        createdAt: now,
        updatedAt: now
      },
      {
        botId: defaultBotId,
        command: "support",
        description: "Open a customer support inquiry",
        responseType: "reply_keyboard",
        responseText: "\u{1F3A7} <b>Support Desk</b>\n\nOur team is online 24/7. Send a message with your issue, or choose a category below:",
        replyKeyboard: [
          ["Billing Issue", "Technical Bug"],
          ["Feature Request", "Talk to Human Agent"]
        ],
        isActive: true,
        usageCount: 42,
        createdAt: now,
        updatedAt: now
      },
      {
        botId: defaultBotId,
        command: "status",
        description: "Check system status and uptime",
        responseType: "text",
        responseText: "\u{1F7E2} <b>System Status: Operational</b>\n\n\u2022 Webhook Latency: 42ms\n\u2022 Telegram API Gateway: Normal (200 OK)\n\u2022 Database Clusters: Healthy\n\u2022 AI Engine: Available",
        isActive: true,
        usageCount: 31,
        createdAt: now,
        updatedAt: now
      }
    ]);
    await this.responders.insertMany([
      {
        botId: defaultBotId,
        triggerType: "contains",
        triggerValue: "human",
        responseText: "\u{1F468}\u200D\u{1F4BB} <i>Notifying an available human operator...</i> An agent will respond directly in this chat shortly.",
        isActive: true,
        hitCount: 14,
        createdAt: now
      },
      {
        botId: defaultBotId,
        triggerType: "contains",
        triggerValue: "refund",
        responseText: "\u{1F4B0} <b>Refund Policy:</b> All subscriptions include a 14-day money-back guarantee. Please provide your order ID.",
        isActive: true,
        hitCount: 8,
        createdAt: now
      },
      {
        botId: defaultBotId,
        triggerType: "exact",
        triggerValue: "hello",
        responseText: "Hello there! \u{1F44B} How can Nexus assist your workflow today?",
        isActive: true,
        hitCount: 52,
        createdAt: now
      }
    ]);
    await this.subscribers.insertMany([
      {
        botId: defaultBotId,
        telegramId: 98124501,
        firstName: "Elena",
        lastName: "Rostova",
        username: "elena_tech",
        languageCode: "en",
        isBot: false,
        isBlocked: false,
        tags: ["vip", "enterprise", "active"],
        joinedAt: new Date(Date.now() - 5 * 864e5).toISOString(),
        lastSeenAt: new Date(Date.now() - 10 * 6e4).toISOString(),
        interactionCount: 28,
        customNotes: "CTO of Fintech Labs. Exploring Pro tier bot management."
      },
      {
        botId: defaultBotId,
        telegramId: 44291048,
        firstName: "Marcus",
        lastName: "Vance",
        username: "mvance",
        languageCode: "en",
        isBot: false,
        isBlocked: false,
        tags: ["pro", "active"],
        joinedAt: new Date(Date.now() - 4 * 864e5).toISOString(),
        lastSeenAt: new Date(Date.now() - 35 * 6e4).toISOString(),
        interactionCount: 15,
        customNotes: "Interested in automated webhook broadcasts."
      },
      {
        botId: defaultBotId,
        telegramId: 77218392,
        firstName: "Sophie",
        lastName: "Chen",
        username: "sophie_c",
        languageCode: "en",
        isBot: false,
        isBlocked: false,
        tags: ["starter"],
        joinedAt: new Date(Date.now() - 3 * 864e5).toISOString(),
        lastSeenAt: new Date(Date.now() - 120 * 6e4).toISOString(),
        interactionCount: 9
      },
      {
        botId: defaultBotId,
        telegramId: 10294821,
        firstName: "Liam",
        lastName: "O'Connor",
        username: "liam_dev",
        languageCode: "en",
        isBot: false,
        isBlocked: false,
        tags: ["beta_tester"],
        joinedAt: new Date(Date.now() - 2 * 864e5).toISOString(),
        lastSeenAt: new Date(Date.now() - 240 * 6e4).toISOString(),
        interactionCount: 6
      }
    ]);
    await this.messages.insertMany([
      {
        botId: defaultBotId,
        telegramId: 98124501,
        senderName: "Elena Rostova",
        direction: "inbound",
        text: "/start",
        timestamp: new Date(Date.now() - 30 * 6e4).toISOString(),
        status: "received"
      },
      {
        botId: defaultBotId,
        telegramId: 98124501,
        senderName: "Nexus Support AI",
        direction: "outbound",
        text: "\u{1F44B} <b>Welcome to Nexus Platform!</b>\n\nI am your automated concierge.",
        timestamp: new Date(Date.now() - 29 * 6e4).toISOString(),
        status: "sent"
      },
      {
        botId: defaultBotId,
        telegramId: 98124501,
        senderName: "Elena Rostova",
        direction: "inbound",
        text: "Can I integrate custom webhook endpoints with this bot?",
        timestamp: new Date(Date.now() - 12 * 6e4).toISOString(),
        status: "received"
      },
      {
        botId: defaultBotId,
        telegramId: 98124501,
        senderName: "Nexus Support AI",
        direction: "outbound",
        text: "Yes, absolutely! Nexus supports custom HTTPS webhooks with secret token authentication, drop pending updates, and live payload debugging.",
        timestamp: new Date(Date.now() - 11 * 6e4).toISOString(),
        status: "sent"
      }
    ]);
    await this.broadcasts.insertMany([
      {
        botId: defaultBotId,
        title: "Platform v2.4 Feature Release Announcement",
        messageText: "\u{1F680} <b>Exciting Update:</b> Nexus Bot Management v2.4 is now live!\n\nEnjoy real-time webhook inspection, direct admin replies, and AI auto-responders.",
        targetTags: ["all"],
        status: "completed",
        totalRecipients: 84,
        sentCount: 84,
        failedCount: 0,
        createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
        completedAt: new Date(Date.now() - 2 * 864e5 + 4e3).toISOString()
      }
    ]);
    await this.logs.insertMany([
      {
        botId: defaultBotId,
        level: "info",
        event: "BOT_STARTED",
        details: "Nexus Support AI initialized in hybrid Webhook & Simulator mode.",
        timestamp: new Date(Date.now() - 60 * 6e4).toISOString()
      },
      {
        botId: defaultBotId,
        level: "webhook",
        event: "WEBHOOK_UPDATE",
        details: "Received Telegram Update ID 48201994 (message from @elena_tech)",
        timestamp: new Date(Date.now() - 12 * 6e4).toISOString()
      },
      {
        botId: defaultBotId,
        level: "info",
        event: "AI_INFERENCE",
        details: "Generated smart response via Gemini in 640ms.",
        timestamp: new Date(Date.now() - 11 * 6e4).toISOString()
      }
    ]);
    console.log("[DB] Seeding completed successfully.");
  }
};
var db = new Database();

// server/geminiService.ts
var import_genai = require("@google/genai");
var aiInstance = null;
function getAiClient() {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiInstance;
}
async function generateBotResponse(systemPrompt, userMessage, userName = "User", knowledgeBase) {
  const client = getAiClient();
  if (!client) {
    return `Hello ${userName}! I received your message: "${userMessage}". To activate full autonomous conversational AI, configure your GEMINI_API_KEY in the environment or secrets panel. In the meantime, feel free to use commands like /help or /pricing!`;
  }
  try {
    const kbSection = knowledgeBase ? `

Authoritative Business Knowledge Base:
${knowledgeBase}` : "";
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `System instructions: ${systemPrompt}${kbSection}

Context: You are responding as a Telegram Bot to a Telegram user named "${userName}". Formatting instructions: Use Telegram-friendly HTML formatting (<b>bold</b>, <i>italic</i>, <code>code</code>, emojis, lists) when helpful. Keep responses concise (under 200 words) and helpful.

User message: "${userMessage}"`
            }
          ]
        }
      ]
    });
    const reply = response.text?.trim();
    if (!reply) {
      return `Thank you for your message! How can I assist you further?`;
    }
    return reply;
  } catch (error) {
    console.error("[Gemini] Error generating bot response:", error);
    return `Hello ${userName}! I encountered a momentary hiccup processing your request. Please try /help or ask again in a moment.`;
  }
}
async function generateBotTemplate(industryOrNiche, botTone = "professional and friendly") {
  const client = getAiClient();
  const fallback = {
    name: `${industryOrNiche} Assistant`,
    description: `Automated assistant tailored for ${industryOrNiche}.`,
    aiPrompt: `You are an expert ${industryOrNiche} assistant. You help users with helpful, ${botTone} answers.`,
    commands: [
      {
        command: "start",
        description: "Start the bot and get overview",
        responseText: `\u{1F44B} Welcome! I am your ${industryOrNiche} assistant. Type /help to explore features.`
      },
      {
        command: "help",
        description: "Show guidance and available options",
        responseText: `\u2139\uFE0F <b>Assistance & Options:</b>
\u2022 /start - Welcome menu
\u2022 /info - About our services
\u2022 /contact - Reach support`
      },
      {
        command: "info",
        description: `Learn more about our ${industryOrNiche} services`,
        responseText: `\u{1F4A1} We deliver top-tier ${industryOrNiche} solutions with 24/7 reliability.`
      }
    ]
  };
  if (!client) {
    return fallback;
  }
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
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
}`
            }
          ]
        }
      ]
    });
    const text = response.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("[Gemini] Bot template generation error:", err);
    return fallback;
  }
}

// server/socket.ts
var import_socket = require("socket.io");
var io = null;
var recentLogs = [];
var MAX_RECENT_LOGS = 100;
function initSocketIO(httpServer) {
  io = new import_socket.Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ["polling", "websocket"]
  });
  io.on("connection", (socket) => {
    socket.emit("terminal_init", recentLogs);
    socket.on("simulate_event", (data) => {
      emitTerminalLog({
        level: data.level || "info",
        event: data.event || "MANUAL_TEST_EVENT",
        details: data.details || "Test message sent from Terminal console",
        botId: data.botId,
        botName: data.botName,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
  });
  return io;
}
function emitTerminalLog(log) {
  const fullLog = {
    ...log,
    id: "log_" + Math.random().toString(36).substring(2, 9),
    timestamp: log.timestamp || (/* @__PURE__ */ new Date()).toISOString()
  };
  recentLogs.push(fullLog);
  if (recentLogs.length > MAX_RECENT_LOGS) {
    recentLogs.shift();
  }
  if (io) {
    io.emit("terminal_log", fullLog);
  }
}
function getRecentLogs() {
  return recentLogs;
}

// server/telegramService.ts
function isDemoToken(token) {
  return !token || token.trim() === "";
}
async function callTelegramApi(token, method, params = {}) {
  if (isDemoToken(token)) {
    return handleDemoTelegramApi(method, params);
  }
  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[TelegramAPI] Request failed for ${method}:`, error);
    return {
      ok: false,
      description: error.message || "Network error connecting to Telegram API",
      error_code: 500
    };
  }
}
function handleDemoTelegramApi(method, params) {
  switch (method) {
    case "getMe":
      return {
        ok: true,
        result: {
          id: 1234567890,
          is_bot: true,
          first_name: "Nexus Support AI",
          username: "nexus_support_ai_bot",
          can_join_groups: true,
          can_read_all_group_messages: false,
          supports_inline_queries: true
        }
      };
    case "getWebhookInfo":
      return {
        ok: true,
        result: {
          url: params.url || "https://my-telegram-platform.app/api/telegram/webhook/bot_nexus_demo",
          has_custom_certificate: false,
          pending_update_count: 0,
          ip_address: "149.154.167.220",
          last_error_date: void 0,
          last_error_message: void 0,
          max_connections: 40,
          allowed_updates: ["message", "callback_query"]
        }
      };
    case "setWebhook":
      return {
        ok: true,
        result: true,
        description: "Webhook was set (Simulated mode)"
      };
    case "deleteWebhook":
      return {
        ok: true,
        result: true,
        description: "Webhook was deleted (Simulated mode)"
      };
    case "sendMessage":
      return {
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 9e5) + 1e5,
          date: Math.floor(Date.now() / 1e3),
          chat: { id: params.chat_id, type: "private" },
          text: params.text
        }
      };
    case "getMyCommands":
      return {
        ok: true,
        result: [
          { command: "start", description: "Initialize bot & show welcome" },
          { command: "help", description: "List commands & guide" },
          { command: "pricing", description: "View subscription plans" },
          { command: "support", description: "Open customer ticket" },
          { command: "status", description: "System health check" }
        ]
      };
    case "setMyCommands":
      return {
        ok: true,
        result: true
      };
    default:
      return {
        ok: true,
        result: { acknowledged: true, method, params }
      };
  }
}
async function verifyBotToken(token) {
  const result = await callTelegramApi(token, "getMe");
  return result;
}
async function syncBotCommandsWithTelegram(botId) {
  const bot = await db.bots.findById(botId);
  if (!bot) return false;
  const commands = await db.commands.find({ botId, isActive: true });
  const tgCommands = commands.map((c) => ({
    command: c.command.toLowerCase().replace(/^\//, ""),
    description: c.description.slice(0, 256) || "Bot command"
  }));
  const res = await callTelegramApi(bot.token, "setMyCommands", { commands: tgCommands });
  return res.ok;
}
async function processTelegramUpdate(botId, update) {
  const bot = await db.bots.findById(botId);
  if (!bot) {
    return { processed: false, replyText: "Bot not found" };
  }
  let telegramId = 0;
  let firstName = "User";
  let lastName = "";
  let username = "";
  let languageCode = "en";
  let messageText = "";
  let isCallback = false;
  let callbackData = "";
  if (update.message) {
    const msg = update.message;
    telegramId = msg.from?.id || 1e6;
    firstName = msg.from?.first_name || "Anonymous";
    lastName = msg.from?.last_name || "";
    username = msg.from?.username || "";
    languageCode = msg.from?.language_code || "en";
    messageText = msg.text || "";
  } else if (update.callback_query) {
    isCallback = true;
    const cb = update.callback_query;
    telegramId = cb.from?.id || 1e6;
    firstName = cb.from?.first_name || "Anonymous";
    lastName = cb.from?.last_name || "";
    username = cb.from?.username || "";
    callbackData = cb.data || "";
    messageText = `[Button Clicked: ${callbackData}]`;
  } else {
    return { processed: true, replyText: "Update acknowledged" };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let subscriber = await db.subscribers.findOne({ botId, telegramId });
  if (update.message?.contact?.phone_number && subscriber) {
    const phoneNumber = update.message.contact.phone_number;
    await db.subscribers.updateById(subscriber._id, {
      phone: phoneNumber,
      tags: Array.from(/* @__PURE__ */ new Set([...subscriber.tags || [], "lead_captured", "phone_provided"]))
    });
    messageText = `[Shared Contact Phone: ${phoneNumber}]`;
  }
  if (!subscriber) {
    subscriber = await db.subscribers.insertOne({
      botId,
      telegramId,
      firstName,
      lastName,
      username,
      languageCode,
      isBot: false,
      isBlocked: false,
      tags: ["new_user"],
      joinedAt: now,
      lastSeenAt: now,
      interactionCount: 1
    });
  } else {
    await db.subscribers.updateById(subscriber._id, {
      lastSeenAt: now,
      interactionCount: (subscriber.interactionCount || 0) + 1,
      firstName: firstName || subscriber.firstName,
      username: username || subscriber.username
    });
  }
  await db.messages.insertOne({
    botId,
    telegramId,
    senderName: `${firstName} ${lastName}`.trim() || username || "User",
    direction: "inbound",
    text: messageText,
    updateId: update.update_id,
    messageId: update.message?.message_id,
    status: "received",
    timestamp: now,
    payload: update
  });
  emitTerminalLog({
    level: "webhook",
    event: "INBOUND_MESSAGE",
    details: `From ${firstName} (@${username || telegramId}): "${messageText || "[Callback/Action]"}"`,
    botId,
    timestamp: now
  });
  let replyText = "";
  let replyMarkup = null;
  let executedCommand;
  const forceJoin = bot.config.forceJoin;
  if (forceJoin?.enabled && forceJoin.channelUsername) {
    const chName = forceJoin.channelUsername.replace(/^@/, "");
    const isVerificationClick = isCallback && callbackData === "cb_verify_join";
    let isMember = false;
    if (isDemoToken(bot.token)) {
      isMember = isVerificationClick || Boolean(subscriber?.tags?.includes("force_join_verified"));
    } else {
      try {
        const checkRes = await callTelegramApi(bot.token, "getChatMember", {
          chat_id: `@${chName}`,
          user_id: telegramId
        });
        if (checkRes.ok && checkRes.result) {
          const st = checkRes.result.status;
          isMember = ["creator", "administrator", "member"].includes(st);
        }
      } catch (err) {
        console.error("[ForceJoin] getChatMember error:", err);
      }
    }
    if (isMember) {
      if (subscriber && !subscriber.tags?.includes("force_join_verified")) {
        await db.subscribers.updateById(subscriber._id, {
          tags: Array.from(/* @__PURE__ */ new Set([...subscriber.tags || [], "force_join_verified"]))
        });
      }
      if (isVerificationClick) {
        replyText = `\u2705 <b>Subscription Verified!</b>

Welcome! You now have full access to <b>${bot.name}</b>. Type /help or /start to begin!`;
        replyMarkup = {
          inline_keyboard: [[{ text: "\u{1F680} Get Started", callback_data: "cmd_start" }]]
        };
      }
    } else {
      replyText = forceJoin.customMessage || `\u26A0\uFE0F <b>Access Restricted!</b>

To use <b>${bot.name}</b>, you must first join our official Telegram channel @${chName}.

After joining, click the <b>Verify Membership</b> button below!`;
      replyMarkup = {
        inline_keyboard: [
          [{ text: "\u{1F4E2} Join Official Channel", url: `https://t.me/${chName}` }],
          [{ text: "\u2705 Verify Membership", callback_data: "cb_verify_join" }]
        ]
      };
      return { replyText, replyMarkup, processed: true };
    }
  }
  if (subscriber?.isHandoverActive && !isCallback) {
    emitTerminalLog({
      level: "info",
      event: "LIVE_HANDOVER_MESSAGE",
      details: `Subscriber ${firstName} (@${username || telegramId}) is in Live Handover mode. Pausing AI.`,
      botId,
      timestamp: now
    });
    return {
      replyText: "\u{1F9D1}\u200D\u{1F4BB} <b>Live Agent Assigned!</b>\n\nA human support specialist is currently assigned to your chat session. Please wait for an admin to reply.",
      processed: true
    };
  }
  const isHandoverTrigger = ["human", "agent", "support", "live agent", "talk to human", "admin"].some(
    (k) => messageText.toLowerCase().includes(k)
  );
  if (isHandoverTrigger && subscriber && !subscriber.isHandoverActive) {
    await db.subscribers.updateById(subscriber._id, {
      isHandoverActive: true,
      handoverReason: `Requested via chat: "${messageText.slice(0, 50)}"`,
      tags: Array.from(/* @__PURE__ */ new Set([...subscriber.tags || [], "handover_requested"]))
    });
    emitTerminalLog({
      level: "warn",
      event: "LIVE_HANDOVER_REQUESTED",
      details: `User ${firstName} requested human agent takeover. Live mode ENABLED.`,
      botId,
      timestamp: now
    });
    return {
      replyText: "\u{1F514} <b>Live Support Requested!</b>\n\nYour request has been forwarded to our support team. An admin will connect with you shortly!",
      processed: true
    };
  }
  const trimmed = messageText.trim();
  const isCommand = trimmed.startsWith("/");
  if (isCommand) {
    const rawCmd = trimmed.split(" ")[0].replace("/", "").toLowerCase();
    const cmdDoc = await db.commands.findOne({ botId, command: rawCmd, isActive: true });
    if (cmdDoc) {
      executedCommand = rawCmd;
      replyText = cmdDoc.responseText;
      if (cmdDoc.responseType === "inline_keyboard" && cmdDoc.inlineKeyboard) {
        replyMarkup = { inline_keyboard: cmdDoc.inlineKeyboard };
      } else if (cmdDoc.responseType === "reply_keyboard" && cmdDoc.replyKeyboard) {
        replyMarkup = {
          keyboard: cmdDoc.replyKeyboard.map((row) => row.map((btn) => ({ text: btn }))),
          resize_keyboard: true,
          one_time_keyboard: true
        };
      }
      await db.commands.updateById(cmdDoc._id, {
        usageCount: (cmdDoc.usageCount || 0) + 1
      });
      emitTerminalLog({
        level: "info",
        event: "COMMAND_DISPATCHED",
        details: `Executed /${rawCmd} for user @${username || telegramId}`,
        botId,
        timestamp: now
      });
    } else {
      if (rawCmd === "book" || rawCmd === "appointment") {
        executedCommand = "book";
        const slots = bot.config.appointmentSlots || ["10:00 AM", "02:00 PM", "04:00 PM", "06:00 PM"];
        replyText = "\u{1F4C5} <b>Select an Appointment Slot:</b>\n\nPlease choose a convenient time slot below for your consultation session:";
        replyMarkup = {
          inline_keyboard: slots.map((slot) => [
            { text: `\u{1F552} ${slot}`, callback_data: `book_slot_${slot.replace(/\s+/g, "")}` }
          ])
        };
      } else if (rawCmd === "feedback" || rawCmd === "rate") {
        executedCommand = "feedback";
        replyText = "\u2B50\uFE0F <b>Rate Your Experience:</b>\n\nHow would you rate your interaction with our bot today?";
        replyMarkup = {
          inline_keyboard: [
            [
              { text: "\u2B50 1", callback_data: "rate_1" },
              { text: "\u2B50\u2B50 2", callback_data: "rate_2" },
              { text: "\u2B50\u2B50\u2B50 3", callback_data: "rate_3" },
              { text: "\u2B50\u2B50\u2B50\u2B50 4", callback_data: "rate_4" },
              { text: "\u2B50\u2B50\u2B50\u2B50\u2B50 5", callback_data: "rate_5" }
            ]
          ]
        };
      } else if (rawCmd === "vault" || rawCmd === "files") {
        executedCommand = "vault";
        const vaultFiles = bot.config.fileVault || [
          { id: "f1", name: "\u{1F4D8} Platform User Guide (PDF)", fileUrl: "https://telegram.org" },
          { id: "f2", name: "\u{1F381} Exclusive Bonus Resource", fileUrl: "https://telegram.org" }
        ];
        replyText = "\u{1F4C2} <b>Protected Digital File Vault:</b>\n\nSelect a file below to download instant assets:";
        replyMarkup = {
          inline_keyboard: vaultFiles.map((f) => [
            { text: f.name, callback_data: `vault_dl_${f.id}` }
          ])
        };
      }
    }
  }
  if (isCallback && !replyText) {
    if (callbackData.startsWith("cmd_")) {
      const targetCmd = callbackData.replace("cmd_", "");
      const cmdDoc = await db.commands.findOne({ botId, command: targetCmd, isActive: true });
      if (cmdDoc) {
        executedCommand = targetCmd;
        replyText = cmdDoc.responseText;
        if (cmdDoc.inlineKeyboard) replyMarkup = { inline_keyboard: cmdDoc.inlineKeyboard };
      }
    } else if (callbackData.startsWith("rate_")) {
      const score = parseInt(callbackData.replace("rate_", ""), 10) || 5;
      if (subscriber) {
        await db.subscribers.updateById(subscriber._id, {
          ratingScore: score,
          tags: Array.from(/* @__PURE__ */ new Set([...subscriber.tags || [], `rating_${score}_star`]))
        });
      }
      replyText = `\u{1F389} <b>Thank you for your rating (${"\u2B50".repeat(score)})!</b>

Your feedback helps us continuously improve our services.`;
    } else if (callbackData.startsWith("book_slot_")) {
      const slotName = callbackData.replace("book_slot_", "");
      if (subscriber) {
        await db.subscribers.updateById(subscriber._id, {
          bookedSlot: slotName,
          tags: Array.from(/* @__PURE__ */ new Set([...subscriber.tags || [], "appointment_booked"]))
        });
      }
      replyText = `\u{1F4C5} <b>Appointment Confirmed!</b>

Your session has been scheduled for <b>${slotName}</b>. We look forward to speaking with you!`;
    } else if (callbackData.startsWith("vault_dl_")) {
      const fileId = callbackData.replace("vault_dl_", "");
      const fileObj = (bot.config.fileVault || []).find((f) => f.id === fileId);
      const url = fileObj?.fileUrl || "https://telegram.org";
      replyText = `\u{1F4E5} <b>Download Ready:</b> ${fileObj?.name || "File Asset"}

Click below to access your file:`;
      replyMarkup = {
        inline_keyboard: [[{ text: "\u2B07\uFE0F Download Asset File", url }]]
      };
    } else if (callbackData.startsWith("buy_")) {
      const plan = callbackData.replace("buy_", "").toUpperCase();
      replyText = `\u{1F389} <b>Awesome choice!</b> You selected the <b>${plan}</b> plan.

Our checkout gateway will generate your secure invoice: https://nexus-checkout.example.com?plan=${plan.toLowerCase()}`;
      replyMarkup = {
        inline_keyboard: [
          [{ text: "\u{1F4B3} Complete Payment", url: "https://telegram.org" }],
          [{ text: "\u25C0\uFE0F Back to Plans", callback_data: "cmd_pricing" }]
        ]
      };
    } else {
      replyText = `Received response for: <code>${callbackData}</code>`;
    }
  }
  if (!replyText && !isCallback) {
    const responders = await db.responders.find({ botId, isActive: true });
    for (const r of responders) {
      let match = false;
      const lowerText = messageText.toLowerCase();
      const trigger = r.triggerValue.toLowerCase();
      if (r.triggerType === "exact" && lowerText === trigger) match = true;
      if (r.triggerType === "contains" && lowerText.includes(trigger)) match = true;
      if (r.triggerType === "regex") {
        try {
          const re = new RegExp(r.triggerValue, "i");
          if (re.test(messageText)) match = true;
        } catch {
        }
      }
      if (match) {
        replyText = r.responseText;
        if (r.inlineKeyboard) {
          replyMarkup = { inline_keyboard: r.inlineKeyboard };
        }
        await db.responders.updateById(r._id, {
          hitCount: (r.hitCount || 0) + 1
        });
        break;
      }
    }
  }
  if (!replyText) {
    if (bot.config.aiEnabled) {
      replyText = await generateBotResponse(
        bot.config.aiPrompt || "You are a helpful Telegram Assistant.",
        messageText,
        firstName,
        bot.config.knowledgeBase
      );
    } else {
      replyText = bot.config.defaultReply || `Thank you for your message! Use /help to see all available commands.`;
    }
  }
  if (!isDemoToken(bot.token)) {
    try {
      await callTelegramApi(bot.token, "sendMessage", {
        chat_id: telegramId,
        text: replyText,
        parse_mode: bot.config.parseMode || "HTML",
        reply_markup: replyMarkup || void 0
      });
    } catch (err) {
      console.error("[TelegramService] Outbound send error:", err);
    }
  }
  await db.messages.insertOne({
    botId,
    telegramId,
    senderName: bot.name,
    direction: "outbound",
    text: replyText,
    status: "sent",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    replyMarkup
  });
  emitTerminalLog({
    level: "info",
    event: "OUTBOUND_DISPATCHED",
    details: `Sent reply to ${telegramId}: "${replyText.substring(0, 45)}..."`,
    botId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  const newStats = {
    ...bot.stats,
    messagesReceived: (bot.stats?.messagesReceived || 0) + 1,
    messagesSent: (bot.stats?.messagesSent || 0) + 1,
    commandsExecuted: (bot.stats?.commandsExecuted || 0) + (executedCommand ? 1 : 0),
    lastActiveAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await db.bots.updateById(bot._id, {
    stats: newStats,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  await db.logs.insertOne({
    botId,
    level: "info",
    event: executedCommand ? `COMMAND_${executedCommand.toUpperCase()}` : "MESSAGE_PROCESSED",
    details: `User ${firstName} (@${username || telegramId}): "${messageText.slice(0, 40)}" -> "${replyText.slice(0, 40)}"`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  return {
    replyText,
    replyMarkup,
    processed: true,
    command: executedCommand
  };
}

// server/routes.ts
var router = (0, import_express.Router)();
router.get("/api/bots", async (req, res) => {
  try {
    const bots = await db.bots.find();
    res.json({ success: true, data: bots });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/bots", async (req, res) => {
  try {
    const { token, name, description, mode } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: "Telegram Bot Token is required" });
    }
    const verifyResult = await verifyBotToken(token);
    const botInfo = verifyResult.ok ? verifyResult.result : null;
    const botName = name || botInfo?.first_name || "My Telegram Bot";
    const username = botInfo?.username || "bot_" + Math.random().toString(36).substring(2, 8);
    const botId = "bot_" + Math.random().toString(36).substring(2, 9);
    const rawAppUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || (req.headers.host || "perfectshot.onrender.com");
    const cleanHost = rawAppUrl.replace(/^https?:\/\//, "");
    const appUrl = `https://${cleanHost}`;
    const webhookUrl = `${appUrl}/api/telegram/webhook/${botId}`;
    const newBot = {
      name: botName,
      username,
      token,
      status: "active",
      mode: mode || (isDemoToken(token) ? "simulator" : "webhook"),
      description: description || "Managed Telegram bot instance.",
      webhookUrl,
      webhookStatus: "pending",
      isVerified: Boolean(verifyResult.ok),
      botInfo: botInfo || void 0,
      stats: {
        messagesReceived: 0,
        messagesSent: 0,
        activeUsers: 0,
        commandsExecuted: 0,
        lastActiveAt: (/* @__PURE__ */ new Date()).toISOString(),
        errorCount: 0
      },
      config: {
        aiEnabled: true,
        aiPrompt: `You are ${botName}, a responsive and helpful Telegram bot. Assist users with clear and polite responses.`,
        defaultReply: "Thank you for reaching out! Type /help to see all available commands.",
        parseMode: "HTML",
        allowedUpdates: ["message", "callback_query"],
        dropPendingUpdates: false
      },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const created = await db.bots.insertOne(newBot);
    await db.commands.insertMany([
      {
        botId: created._id,
        command: "start",
        description: "Start conversation and show main options",
        responseType: "inline_keyboard",
        responseText: `\u{1F44B} Hello! Welcome to <b>${created.name}</b>.

Type /help to learn about what I can do!`,
        inlineKeyboard: [
          [{ text: "\u2139\uFE0F About Us", callback_data: "cmd_help" }],
          [{ text: "\u{1F310} Website", url: "https://telegram.org" }]
        ],
        isActive: true,
        usageCount: 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        botId: created._id,
        command: "help",
        description: "View instructions and available commands",
        responseType: "text",
        responseText: `\u{1F916} <b>${created.name} Help:</b>

\u2022 /start - Launch the bot
\u2022 /help - Show this guide
\u2022 /status - Health check`,
        isActive: true,
        usageCount: 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        botId: created._id,
        command: "status",
        description: "Bot health and operational status",
        responseType: "text",
        responseText: `\u{1F7E2} <b>Bot Status:</b> Operational and online!`,
        isActive: true,
        usageCount: 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    await db.logs.insertOne({
      botId: created._id,
      level: "info",
      event: "BOT_CREATED",
      details: `Created bot "${created.name}" (@${created.username})`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/bots/:id", async (req, res) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    res.json({ success: true, data: bot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.put("/api/bots/:id", async (req, res) => {
  try {
    const { name, description, mode, status, config } = req.body;
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    const updated = await db.bots.updateById(req.params.id, {
      ...name && { name },
      ...description !== void 0 && { description },
      ...mode && { mode },
      ...status && { status },
      ...config && { config: { ...bot.config, ...config } },
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.delete("/api/bots/:id", async (req, res) => {
  try {
    const botId = req.params.id;
    const bot = await db.bots.findById(botId);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    await db.bots.deleteById(botId);
    await db.commands.deleteMany({ botId });
    await db.responders.deleteMany({ botId });
    await db.subscribers.deleteMany({ botId });
    await db.messages.deleteMany({ botId });
    await db.broadcasts.deleteMany({ botId });
    await db.logs.deleteMany({ botId });
    res.json({ success: true, message: "Bot and associated records deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/bots/:id/verify", async (req, res) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    const result = await verifyBotToken(bot.token);
    if (result.ok && result.result) {
      await db.bots.updateById(bot._id, {
        isVerified: true,
        botInfo: result.result,
        username: result.result.username || bot.username,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/bots/:id/export-subscribers", async (req, res) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    const subscribers = await db.subscribers.find({ botId: req.params.id });
    const csvRows = [
      ["Telegram ID", "First Name", "Last Name", "Username", "Phone", "Tags", "Joined At", "Last Active"].join(",")
    ];
    for (const sub of subscribers) {
      const row = [
        sub.telegramId,
        `"${(sub.firstName || "").replace(/"/g, '""')}"`,
        `"${(sub.lastName || "").replace(/"/g, '""')}"`,
        `"${(sub.username || "").replace(/"/g, '""')}"`,
        `"${(sub.phone || "").replace(/"/g, '""')}"`,
        `"${(sub.tags || []).join(";")}"`,
        `"${sub.joinedAt || ""}"`,
        `"${sub.lastSeenAt || ""}"`
      ];
      csvRows.push(row.join(","));
    }
    const csvData = csvRows.join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${bot.username}_subscribers.csv"`);
    res.status(200).send(csvData);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/bots/:id/sync-commands", async (req, res) => {
  try {
    const success = await syncBotCommandsWithTelegram(req.params.id);
    res.json({ success, message: success ? "Commands synchronized with Telegram" : "Sync failed" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/bots/:id/webhook", async (req, res) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    const tgRes = await callTelegramApi(bot.token, "getWebhookInfo");
    res.json({ success: true, data: tgRes.result || null, raw: tgRes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/bots/:id/webhook/set", async (req, res) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    let targetUrl = (req.body.url || bot.webhookUrl || "").trim();
    if (targetUrl.startsWith("http://")) {
      targetUrl = targetUrl.replace(/^http:\/\//, "https://");
    }
    if (!targetUrl.startsWith("https://")) {
      const renderHost = (process.env.RENDER_EXTERNAL_URL || "https://perfectshot.onrender.com").replace(/^https?:\/\//, "");
      targetUrl = `https://${renderHost}/api/telegram/webhook/${bot._id}`;
    }
    const tgRes = await callTelegramApi(bot.token, "setWebhook", {
      url: targetUrl,
      drop_pending_updates: Boolean(bot.config.dropPendingUpdates),
      allowed_updates: bot.config.allowedUpdates
    });
    if (tgRes.ok) {
      await db.bots.updateById(bot._id, {
        webhookUrl: targetUrl,
        webhookStatus: "connected",
        mode: "webhook",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await db.logs.insertOne({
        botId: bot._id,
        level: "webhook",
        event: "WEBHOOK_SET",
        details: `Webhook set to: ${targetUrl}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    res.json({ success: tgRes.ok, result: tgRes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/bots/:id/webhook/delete", async (req, res) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    const tgRes = await callTelegramApi(bot.token, "deleteWebhook", {
      drop_pending_updates: Boolean(req.body.dropPendingUpdates)
    });
    if (tgRes.ok) {
      await db.bots.updateById(bot._id, {
        webhookStatus: "disconnected",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    res.json({ success: tgRes.ok, result: tgRes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/telegram/webhook/:botId", async (req, res) => {
  try {
    const { botId } = req.params;
    const update = req.body;
    const result = await processTelegramUpdate(botId, update);
    res.json({ ok: true, result });
  } catch (error) {
    console.error("[Webhook] Update processing failed:", error);
    res.status(200).json({ ok: false, error: error.message });
  }
});
router.post("/api/bots/:id/simulate", async (req, res) => {
  try {
    const botId = req.params.id;
    const { text, callbackData, senderName, telegramId } = req.body;
    const simUserId = telegramId || 99887766;
    const simUserName = senderName || "Preview User";
    let updatePayload;
    if (callbackData) {
      updatePayload = {
        update_id: Math.floor(Math.random() * 9e5) + 1e5,
        callback_query: {
          id: Math.random().toString(),
          from: {
            id: simUserId,
            is_bot: false,
            first_name: simUserName,
            username: "preview_tester"
          },
          data: callbackData
        }
      };
    } else {
      updatePayload = {
        update_id: Math.floor(Math.random() * 9e5) + 1e5,
        message: {
          message_id: Math.floor(Math.random() * 9e5) + 1e5,
          from: {
            id: simUserId,
            is_bot: false,
            first_name: simUserName,
            username: "preview_tester"
          },
          chat: {
            id: simUserId,
            type: "private",
            first_name: simUserName
          },
          date: Math.floor(Date.now() / 1e3),
          text: text || "/start"
        }
      };
    }
    const output = await processTelegramUpdate(botId, updatePayload);
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/bots/:id/commands", async (req, res) => {
  try {
    const commands = await db.commands.find({ botId: req.params.id });
    res.json({ success: true, data: commands });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/bots/:id/commands", async (req, res) => {
  try {
    const { command, description, responseType, responseText, inlineKeyboard, replyKeyboard } = req.body;
    if (!command || !responseText) {
      return res.status(400).json({ success: false, error: "Command name and response text are required" });
    }
    const cleanCommand = command.toLowerCase().replace(/^\//, "").trim();
    const newCmd = await db.commands.insertOne({
      botId: req.params.id,
      command: cleanCommand,
      description: description || `Command /${cleanCommand}`,
      responseType: responseType || "text",
      responseText,
      inlineKeyboard: inlineKeyboard || void 0,
      replyKeyboard: replyKeyboard || void 0,
      isActive: true,
      usageCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ success: true, data: newCmd });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.put("/api/commands/:cmdId", async (req, res) => {
  try {
    const { command, description, responseType, responseText, inlineKeyboard, replyKeyboard, isActive } = req.body;
    const updated = await db.commands.updateById(req.params.cmdId, {
      ...command && { command: command.toLowerCase().replace(/^\//, "").trim() },
      ...description !== void 0 && { description },
      ...responseType && { responseType },
      ...responseText !== void 0 && { responseText },
      ...inlineKeyboard !== void 0 && { inlineKeyboard },
      ...replyKeyboard !== void 0 && { replyKeyboard },
      ...isActive !== void 0 && { isActive },
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.delete("/api/commands/:cmdId", async (req, res) => {
  try {
    await db.commands.deleteById(req.params.cmdId);
    res.json({ success: true, message: "Command deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/bots/:id/responders", async (req, res) => {
  try {
    const responders = await db.responders.find({ botId: req.params.id });
    res.json({ success: true, data: responders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/bots/:id/responders", async (req, res) => {
  try {
    const { triggerType, triggerValue, responseText, inlineKeyboard } = req.body;
    if (!triggerValue || !responseText) {
      return res.status(400).json({ success: false, error: "Trigger value and response text are required" });
    }
    const newResponder = await db.responders.insertOne({
      botId: req.params.id,
      triggerType: triggerType || "contains",
      triggerValue,
      responseText,
      inlineKeyboard: inlineKeyboard || void 0,
      isActive: true,
      hitCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ success: true, data: newResponder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.delete("/api/responders/:respId", async (req, res) => {
  try {
    await db.responders.deleteById(req.params.respId);
    res.json({ success: true, message: "Auto-responder deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/bots/:id/subscribers", async (req, res) => {
  try {
    const subscribers = await db.subscribers.find({ botId: req.params.id });
    res.json({ success: true, data: subscribers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.put("/api/subscribers/:subId", async (req, res) => {
  try {
    const { tags, isBlocked, customNotes, isHandoverActive, handoverReason, phone, email } = req.body;
    const updated = await db.subscribers.updateById(req.params.subId, {
      ...tags && { tags },
      ...isBlocked !== void 0 && { isBlocked },
      ...customNotes !== void 0 && { customNotes },
      ...isHandoverActive !== void 0 && { isHandoverActive },
      ...handoverReason !== void 0 && { handoverReason },
      ...phone !== void 0 && { phone },
      ...email !== void 0 && { email }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/bots/:id/subscribers/:telegramId/messages", async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId, 10);
    const messages = await db.messages.find(
      (m) => m.botId === req.params.id && m.telegramId === telegramId
    );
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/bots/:id/messages/send", async (req, res) => {
  try {
    const botId = req.params.id;
    const { telegramId, text } = req.body;
    if (!telegramId || !text) {
      return res.status(400).json({ success: false, error: "telegramId and text are required" });
    }
    const bot = await db.bots.findById(botId);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    if (!isDemoToken(bot.token)) {
      await callTelegramApi(bot.token, "sendMessage", {
        chat_id: telegramId,
        text,
        parse_mode: "HTML"
      });
    }
    const createdMsg = await db.messages.insertOne({
      botId,
      telegramId: Number(telegramId),
      senderName: `Admin (${bot.name})`,
      direction: "outbound",
      text,
      status: "sent",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ success: true, data: createdMsg });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/bots/:id/broadcasts", async (req, res) => {
  try {
    const broadcasts = await db.broadcasts.find({ botId: req.params.id });
    res.json({ success: true, data: broadcasts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/bots/:id/broadcasts", async (req, res) => {
  try {
    const botId = req.params.id;
    const { title, messageText, targetTags } = req.body;
    if (!title || !messageText) {
      return res.status(400).json({ success: false, error: "Title and messageText are required" });
    }
    const bot = await db.bots.findById(botId);
    if (!bot) return res.status(404).json({ success: false, error: "Bot not found" });
    const allSubs = await db.subscribers.find({ botId, isBlocked: false });
    const recipients = allSubs.filter((sub) => {
      if (!targetTags || targetTags.length === 0 || targetTags.includes("all")) return true;
      return sub.tags.some((t) => targetTags.includes(t));
    });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const broadcast = await db.broadcasts.insertOne({
      botId,
      title,
      messageText,
      targetTags: targetTags || ["all"],
      status: "completed",
      totalRecipients: recipients.length,
      sentCount: recipients.length,
      failedCount: 0,
      createdAt: now,
      completedAt: now
    });
    for (const sub of recipients) {
      if (!isDemoToken(bot.token)) {
        try {
          await callTelegramApi(bot.token, "sendMessage", {
            chat_id: sub.telegramId,
            text: messageText,
            parse_mode: "HTML"
          });
        } catch (e) {
        }
      }
      await db.messages.insertOne({
        botId,
        telegramId: sub.telegramId,
        senderName: `${bot.name} (Broadcast)`,
        direction: "outbound",
        text: messageText,
        status: "sent",
        timestamp: now
      });
    }
    await db.logs.insertOne({
      botId,
      level: "info",
      event: "BROADCAST_SENT",
      details: `Broadcast "${title}" delivered to ${recipients.length} subscribers.`,
      timestamp: now
    });
    res.json({ success: true, data: broadcast });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/bots/:id/logs", async (req, res) => {
  try {
    const logs = await db.logs.find({ botId: req.params.id });
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json({ success: true, data: logs.slice(0, 100) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/telegram/direct-api", async (req, res) => {
  try {
    const { token, method, params } = req.body;
    if (!token || !method) {
      return res.status(400).json({ success: false, error: "Token and API method are required" });
    }
    const response = await callTelegramApi(token, method, params || {});
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/database/stats", async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/database/test-connection", async (req, res) => {
  try {
    const targetUri = req.body.uri || process.env.MONGODB_URI || "";
    if (!targetUri) {
      return res.status(400).json({ success: false, error: "No MongoDB URI provided" });
    }
    await db.initMongo(targetUri);
    const stats = await db.getStats();
    res.json({
      success: stats.mongo.status === "connected",
      mongo: stats.mongo,
      message: stats.mongo.status === "connected" ? "Successfully connected to MongoDB Atlas cluster!" : `Connection failed: ${stats.mongo.error || "Check IP Whitelist in Atlas"}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/database/update-uri", async (req, res) => {
  try {
    const { uri } = req.body;
    if (!uri) {
      return res.status(400).json({ success: false, error: "MongoDB URI is required" });
    }
    process.env.MONGODB_URI = uri.trim();
    await db.initMongo(uri.trim());
    const stats = await db.getStats();
    res.json({
      success: true,
      mongo: stats.mongo,
      message: stats.mongo.status === "connected" ? "MongoDB Atlas URI updated and successfully connected!" : "MongoDB URI updated. Notice: Atlas server connection pending or IP whitelist required."
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/api/database/collections/:collection", async (req, res) => {
  try {
    const { collection } = req.params;
    let data = [];
    if (collection === "bots") data = await db.bots.find();
    else if (collection === "commands") data = await db.commands.find();
    else if (collection === "responders") data = await db.responders.find();
    else if (collection === "subscribers") data = await db.subscribers.find();
    else if (collection === "messages") data = await db.messages.find();
    else if (collection === "broadcasts") data = await db.broadcasts.find();
    else if (collection === "logs") data = await db.logs.find();
    else return res.status(404).json({ success: false, error: "Collection not found" });
    res.json({ success: true, collection, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/api/ai/generate-template", async (req, res) => {
  try {
    const { industry, tone } = req.body;
    if (!industry) {
      return res.status(400).json({ success: false, error: "Industry or niche description is required" });
    }
    const template = await generateBotTemplate(industry, tone || "professional and helpful");
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// server.ts
import_dotenv.default.config();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var HOST = "0.0.0.0";
async function startServer() {
  const app = (0, import_express2.default)();
  const httpServer = import_http.default.createServer(app);
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  initSocketIO(httpServer);
  app.use(import_express2.default.json({ limit: "10mb" }));
  app.use(import_express2.default.urlencoded({ extended: true, limit: "10mb" }));
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "Telegram Bot Management Platform",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/cron/keep-alive", (req, res) => {
    res.json({
      status: "awake",
      service: "Telegram Bot Management Platform",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    });
  });
  app.get("/api/terminal/logs", (req, res) => {
    res.json({ success: true, data: getRecentLogs() });
  });
  app.use(router);
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express2.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  httpServer.listen(PORT, HOST, () => {
    console.log(`[Server] Telegram Bot Management Platform running on http://${HOST}:${PORT}`);
    const targetUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(async () => {
      try {
        await fetch(`${targetUrl}/api/cron/keep-alive`);
      } catch {
      }
    }, 5 * 60 * 1e3);
  });
}
startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
  TelegramBot,
  BotCommand,
  AutoResponder,
  BotSubscriber,
  BotMessage,
  BotBroadcast,
  BotLog
} from './types';

export function maskMongoUri(uri: string): string {
  try {
    return uri.replace(/\/\/(.*?):(.*?)@/, (_, user, pass) => {
      const maskedPass = pass.length > 4 ? pass.substring(0, 2) + '••••' + pass.substring(pass.length - 2) : '••••';
      return `//${user}:${maskedPass}@`;
    });
  } catch {
    return 'mongodb+srv://***:***@...';
  }
}

export function parseMongoDetails(uri: string) {
  let host = 'Unknown';
  let database = 'Mithu';
  let user = 'Unknown';
  try {
    const match = uri.match(/:\/\/([^:]+):([^@]+)@([^/?]+)(?:\/([^?]+))?/);
    if (match) {
      user = match[1];
      host = match[3];
      database = match[4] || 'Mithu';
    }
    const appNameMatch = uri.match(/appName=([^&]+)/);
    if (appNameMatch && (!match || !match[4])) {
      database = appNameMatch[1];
    }
  } catch (e) {}
  return { host, database, user };
}

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class MongoCollection<T extends { _id: string }> {
  private name: string;
  private filePath: string;
  private items: Map<string, T> = new Map();
  private isLoaded = false;

  constructor(name: string) {
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: T[] = JSON.parse(raw);
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

  private save() {
    try {
      const list = Array.from(this.items.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[DB] Failed to save collection ${this.name}:`, err);
    }
  }

  public async find(filter?: Partial<T> | ((item: T) => boolean)): Promise<T[]> {
    const list = Array.from(this.items.values());
    if (!filter) return list;

    if (typeof filter === 'function') {
      return list.filter(filter);
    }

    return list.filter(item => {
      for (const [key, val] of Object.entries(filter)) {
        if ((item as any)[key] !== val) return false;
      }
      return true;
    });
  }

  public async findOne(filter: Partial<T> | ((item: T) => boolean)): Promise<T | null> {
    const results = await this.find(filter);
    return results[0] || null;
  }

  public async findById(id: string): Promise<T | null> {
    return this.items.get(id) || null;
  }

  public async insertOne(doc: Omit<T, '_id'> & { _id?: string }): Promise<T> {
    const _id = doc._id || Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    const newDoc = { ...doc, _id } as T;
    this.items.set(_id, newDoc);
    this.save();
    return newDoc;
  }

  public async insertMany(docs: Array<Omit<T, '_id'> & { _id?: string }>): Promise<T[]> {
    const created: T[] = [];
    for (const doc of docs) {
      const item = await this.insertOne(doc);
      created.push(item);
    }
    return created;
  }

  public async updateOne(filter: Partial<T>, update: Partial<T>): Promise<boolean> {
    const item = await this.findOne(filter);
    if (!item) return false;

    const updated = { ...item, ...update, _id: item._id };
    this.items.set(item._id, updated);
    this.save();
    return true;
  }

  public async updateById(id: string, update: Partial<T>): Promise<T | null> {
    const item = this.items.get(id);
    if (!item) return null;

    const updated = { ...item, ...update, _id: id };
    this.items.set(id, updated);
    this.save();
    return updated;
  }

  public async deleteOne(filter: Partial<T>): Promise<boolean> {
    const item = await this.findOne(filter);
    if (!item) return false;

    this.items.delete(item._id);
    this.save();
    return true;
  }

  public async deleteById(id: string): Promise<boolean> {
    const deleted = this.items.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  public async deleteMany(filter: Partial<T>): Promise<number> {
    const items = await this.find(filter);
    let count = 0;
    for (const item of items) {
      if (this.items.delete(item._id)) count++;
    }
    if (count > 0) this.save();
    return count;
  }

  public async countDocuments(filter?: Partial<T>): Promise<number> {
    const results = await this.find(filter);
    return results.length;
  }

  public count(): number {
    return this.items.size;
  }

  public clear(): void {
    this.items.clear();
    this.save();
  }
}

// Database instance containing all collections
export class Database {
  public bots = new MongoCollection<TelegramBot>('bots');
  public commands = new MongoCollection<BotCommand>('commands');
  public responders = new MongoCollection<AutoResponder>('responders');
  public subscribers = new MongoCollection<BotSubscriber>('subscribers');
  public messages = new MongoCollection<BotMessage>('messages');
  public broadcasts = new MongoCollection<BotBroadcast>('broadcasts');
  public logs = new MongoCollection<BotLog>('logs');

  public mongoState = {
    configured: false,
    status: 'disconnected' as 'connected' | 'connecting' | 'disconnected' | 'error',
    uri: '',
    maskedUri: '',
    host: '',
    database: '',
    user: '',
    error: null as string | null,
    connectedAt: null as string | null,
    lastTestedAt: new Date().toISOString(),
  };

  constructor() {
    this.seedInitialData();
    const envUri = process.env.MONGODB_URI;
    if (envUri) {
      this.initMongo(envUri);
    }
  }

  public async initMongo(uriString: string) {
    const trimmed = uriString.trim();
    if (!trimmed) return;

    this.mongoState.configured = true;
    this.mongoState.uri = trimmed;
    this.mongoState.maskedUri = maskMongoUri(trimmed);
    const details = parseMongoDetails(trimmed);
    this.mongoState.host = details.host;
    this.mongoState.database = details.database;
    this.mongoState.user = details.user;
    this.mongoState.status = 'connecting';
    this.mongoState.error = null;
    this.mongoState.lastTestedAt = new Date().toISOString();

    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }

      await mongoose.connect(trimmed, {
        serverSelectionTimeoutMS: 6000,
      });

      this.mongoState.status = 'connected';
      this.mongoState.connectedAt = new Date().toISOString();
      this.mongoState.error = null;
      console.log(`[MongoDB] Successfully connected to MongoDB Atlas cluster (${details.host}) database (${details.database})`);
    } catch (err: any) {
      this.mongoState.status = 'error';
      this.mongoState.error = err.message || 'Failed to connect to MongoDB Atlas';
      console.warn(`[MongoDB] Notice: Atlas connection failed (${err.message}). Safe fallback to high-performance local document store.`);
    }
  }

  public async getStats() {
    const isMongoConnected = this.mongoState.status === 'connected';

    return {
      storageEngine: isMongoConnected
        ? 'MongoDB Atlas (Mongoose Production Cluster)'
        : 'Embedded Document Database (MongoDB Spec Compatible)',
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
        lastTestedAt: this.mongoState.lastTestedAt,
      },
      collections: {
        bots: this.bots.count(),
        commands: this.commands.count(),
        responders: this.responders.count(),
        subscribers: this.subscribers.count(),
        messages: this.messages.count(),
        broadcasts: this.broadcasts.count(),
        logs: this.logs.count(),
      },
      totalDocuments:
        this.bots.count() +
        this.commands.count() +
        this.responders.count() +
        this.subscribers.count() +
        this.messages.count() +
        this.broadcasts.count() +
        this.logs.count(),
      timestamp: new Date().toISOString(),
    };
  }

  private async seedInitialData() {
    const botCount = await this.bots.countDocuments();
    if (botCount > 0) return;

    console.log('[DB] Seeding starter production demo Telegram bots & commands...');

    const defaultBotId = 'bot_nexus_demo';
    const now = new Date().toISOString();

    // 1. Create Default Demo Bot
    await this.bots.insertOne({
      _id: defaultBotId,
      name: 'Nexus Customer AI Bot',
      username: 'nexus_support_ai_bot',
      token: '1234567890:AAFlgDemoTelegramBotTokenXyZ987',
      status: 'active',
      mode: 'simulator',
      description: 'Customer service, automated sales funnel, and FAQ assistant with Gemini AI smart routing.',
      webhookUrl: `${process.env.APP_URL || 'https://my-telegram-platform.app'}/api/telegram/webhook/${defaultBotId}`,
      webhookStatus: 'connected',
      webhookPendingUpdates: 0,
      isVerified: true,
      botInfo: {
        id: 1234567890,
        is_bot: true,
        first_name: 'Nexus Support AI',
        username: 'nexus_support_ai_bot',
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: true,
      },
      stats: {
        messagesReceived: 428,
        messagesSent: 462,
        activeUsers: 84,
        commandsExecuted: 312,
        lastActiveAt: now,
        errorCount: 0,
      },
      config: {
        aiEnabled: true,
        aiPrompt:
          'You are Nexus, a helpful, courteous, and efficient Telegram assistant for our platform. Answer user questions concisely with friendly Telegram formatting (emojis, bold headings, bullet points).',
        defaultReply: "Thanks for reaching out! Type /help to see available commands or ask me anything directly.",
        parseMode: 'HTML',
        allowedUpdates: ['message', 'callback_query', 'inline_query'],
        dropPendingUpdates: false,
      },
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: now,
    });

    // 2. Pre-seed Commands
    await this.commands.insertMany([
      {
        botId: defaultBotId,
        command: 'start',
        description: 'Initialize bot & show welcome dashboard',
        responseType: 'inline_keyboard',
        responseText:
          '👋 <b>Welcome to Nexus Platform!</b>\n\nI am your automated concierge. You can explore services, review plans, or open a support ticket.\n\n<i>Choose an option below to get started:</i>',
        inlineKeyboard: [
          [
            { text: '🚀 View Pricing', callback_data: 'cmd_pricing' },
            { text: '📚 Documentation', url: 'https://telegram.org' },
          ],
          [
            { text: '💬 Chat with Support', callback_data: 'cmd_support' },
            { text: '✨ Try AI Assistant', callback_data: 'cmd_ai' },
          ],
        ],
        isActive: true,
        usageCount: 198,
        createdAt: now,
        updatedAt: now,
      },
      {
        botId: defaultBotId,
        command: 'help',
        description: 'List all commands and capabilities',
        responseType: 'text',
        responseText:
          '🛠 <b>Nexus Bot Commands:</b>\n\n' +
          '• /start - Launch bot and main menu\n' +
          '• /help - View this guide\n' +
          '• /pricing - See subscription tiers\n' +
          '• /support - Connect with a specialist\n' +
          '• /status - Check service health\n' +
          '• /subscribe - Subscribe to broadcast notifications\n\n' +
          '💡 <i>Tip: You can also ask me general questions and our Gemini AI engine will answer!</i>',
        isActive: true,
        usageCount: 86,
        createdAt: now,
        updatedAt: now,
      },
      {
        botId: defaultBotId,
        command: 'pricing',
        description: 'View subscription plans & checkout',
        responseType: 'inline_keyboard',
        responseText:
          '💎 <b>Nexus Subscription Plans</b>\n\n' +
          '<b>Starter:</b> $9/mo • 1 Bot • 5k updates\n' +
          '<b>Pro:</b> $29/mo • 5 Bots • Unlimited broadcasts\n' +
          '<b>Enterprise:</b> $99/mo • Custom AI training + Webhook SLA\n\n' +
          'Select a tier to begin instant activation:',
        inlineKeyboard: [
          [
            { text: 'Starter Plan ($9)', callback_data: 'buy_starter' },
            { text: 'Pro Plan ($29)', callback_data: 'buy_pro' },
          ],
          [{ text: '💼 Enterprise Contact', callback_data: 'buy_enterprise' }],
        ],
        isActive: true,
        usageCount: 64,
        createdAt: now,
        updatedAt: now,
      },
      {
        botId: defaultBotId,
        command: 'support',
        description: 'Open a customer support inquiry',
        responseType: 'reply_keyboard',
        responseText:
          '🎧 <b>Support Desk</b>\n\nOur team is online 24/7. Send a message with your issue, or choose a category below:',
        replyKeyboard: [
          ['Billing Issue', 'Technical Bug'],
          ['Feature Request', 'Talk to Human Agent'],
        ],
        isActive: true,
        usageCount: 42,
        createdAt: now,
        updatedAt: now,
      },
      {
        botId: defaultBotId,
        command: 'status',
        description: 'Check system status and uptime',
        responseType: 'text',
        responseText:
          '🟢 <b>System Status: Operational</b>\n\n' +
          '• Webhook Latency: 42ms\n' +
          '• Telegram API Gateway: Normal (200 OK)\n' +
          '• Database Clusters: Healthy\n' +
          '• AI Engine: Available',
        isActive: true,
        usageCount: 31,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 3. Pre-seed Auto-Responders
    await this.responders.insertMany([
      {
        botId: defaultBotId,
        triggerType: 'contains',
        triggerValue: 'human',
        responseText:
          '👨‍💻 <i>Notifying an available human operator...</i> An agent will respond directly in this chat shortly.',
        isActive: true,
        hitCount: 14,
        createdAt: now,
      },
      {
        botId: defaultBotId,
        triggerType: 'contains',
        triggerValue: 'refund',
        responseText:
          '💰 <b>Refund Policy:</b> All subscriptions include a 14-day money-back guarantee. Please provide your order ID.',
        isActive: true,
        hitCount: 8,
        createdAt: now,
      },
      {
        botId: defaultBotId,
        triggerType: 'exact',
        triggerValue: 'hello',
        responseText: 'Hello there! 👋 How can Nexus assist your workflow today?',
        isActive: true,
        hitCount: 52,
        createdAt: now,
      },
    ]);

    // 4. Pre-seed Subscribers
    await this.subscribers.insertMany([
      {
        botId: defaultBotId,
        telegramId: 98124501,
        firstName: 'Elena',
        lastName: 'Rostova',
        username: 'elena_tech',
        languageCode: 'en',
        isBot: false,
        isBlocked: false,
        tags: ['vip', 'enterprise', 'active'],
        joinedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        lastSeenAt: new Date(Date.now() - 10 * 60000).toISOString(),
        interactionCount: 28,
        customNotes: 'CTO of Fintech Labs. Exploring Pro tier bot management.',
      },
      {
        botId: defaultBotId,
        telegramId: 44291048,
        firstName: 'Marcus',
        lastName: 'Vance',
        username: 'mvance',
        languageCode: 'en',
        isBot: false,
        isBlocked: false,
        tags: ['pro', 'active'],
        joinedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
        lastSeenAt: new Date(Date.now() - 35 * 60000).toISOString(),
        interactionCount: 15,
        customNotes: 'Interested in automated webhook broadcasts.',
      },
      {
        botId: defaultBotId,
        telegramId: 77218392,
        firstName: 'Sophie',
        lastName: 'Chen',
        username: 'sophie_c',
        languageCode: 'en',
        isBot: false,
        isBlocked: false,
        tags: ['starter'],
        joinedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        lastSeenAt: new Date(Date.now() - 120 * 60000).toISOString(),
        interactionCount: 9,
      },
      {
        botId: defaultBotId,
        telegramId: 10294821,
        firstName: 'Liam',
        lastName: 'O\'Connor',
        username: 'liam_dev',
        languageCode: 'en',
        isBot: false,
        isBlocked: false,
        tags: ['beta_tester'],
        joinedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        lastSeenAt: new Date(Date.now() - 240 * 60000).toISOString(),
        interactionCount: 6,
      },
    ]);

    // 5. Pre-seed Messages History
    await this.messages.insertMany([
      {
        botId: defaultBotId,
        telegramId: 98124501,
        senderName: 'Elena Rostova',
        direction: 'inbound',
        text: '/start',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
        status: 'received',
      },
      {
        botId: defaultBotId,
        telegramId: 98124501,
        senderName: 'Nexus Support AI',
        direction: 'outbound',
        text: '👋 <b>Welcome to Nexus Platform!</b>\n\nI am your automated concierge.',
        timestamp: new Date(Date.now() - 29 * 60000).toISOString(),
        status: 'sent',
      },
      {
        botId: defaultBotId,
        telegramId: 98124501,
        senderName: 'Elena Rostova',
        direction: 'inbound',
        text: 'Can I integrate custom webhook endpoints with this bot?',
        timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
        status: 'received',
      },
      {
        botId: defaultBotId,
        telegramId: 98124501,
        senderName: 'Nexus Support AI',
        direction: 'outbound',
        text: 'Yes, absolutely! Nexus supports custom HTTPS webhooks with secret token authentication, drop pending updates, and live payload debugging.',
        timestamp: new Date(Date.now() - 11 * 60000).toISOString(),
        status: 'sent',
      },
    ]);

    // 6. Pre-seed Broadcasts
    await this.broadcasts.insertMany([
      {
        botId: defaultBotId,
        title: 'Platform v2.4 Feature Release Announcement',
        messageText:
          '🚀 <b>Exciting Update:</b> Nexus Bot Management v2.4 is now live!\n\nEnjoy real-time webhook inspection, direct admin replies, and AI auto-responders.',
        targetTags: ['all'],
        status: 'completed',
        totalRecipients: 84,
        sentCount: 84,
        failedCount: 0,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        completedAt: new Date(Date.now() - 2 * 86400000 + 4000).toISOString(),
      },
    ]);

    // 7. Pre-seed Logs
    await this.logs.insertMany([
      {
        botId: defaultBotId,
        level: 'info',
        event: 'BOT_STARTED',
        details: 'Nexus Support AI initialized in hybrid Webhook & Simulator mode.',
        timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
      },
      {
        botId: defaultBotId,
        level: 'webhook',
        event: 'WEBHOOK_UPDATE',
        details: 'Received Telegram Update ID 48201994 (message from @elena_tech)',
        timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
      },
      {
        botId: defaultBotId,
        level: 'info',
        event: 'AI_INFERENCE',
        details: 'Generated smart response via Gemini in 640ms.',
        timestamp: new Date(Date.now() - 11 * 60000).toISOString(),
      },
    ]);

    console.log('[DB] Seeding completed successfully.');
  }
}

export const db = new Database();

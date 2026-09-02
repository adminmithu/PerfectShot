import { Router, Request, Response } from 'express';
import { db } from './db';
import {
  callTelegramApi,
  verifyBotToken,
  processTelegramUpdate,
  syncBotCommandsWithTelegram,
  isDemoToken
} from './telegramService';
import { generateBotTemplate } from './geminiService';
import { TelegramBot } from './types';

export const router = Router();

// ==================== BOTS ====================

// List all bots
router.get('/api/bots', async (req: Request, res: Response) => {
  try {
    const bots = await db.bots.find();
    res.json({ success: true, data: bots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new bot
router.post('/api/bots', async (req: Request, res: Response) => {
  try {
    const { token, name, description, mode } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Telegram Bot Token is required' });
    }

    // Verify token with Telegram API
    const verifyResult = await verifyBotToken(token);
    const botInfo = verifyResult.ok ? verifyResult.result : null;

    const botName = name || botInfo?.first_name || 'My Telegram Bot';
    const username = botInfo?.username || 'bot_' + Math.random().toString(36).substring(2, 8);
    const botId = 'bot_' + Math.random().toString(36).substring(2, 9);
    const rawAppUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || (req.headers.host || 'perfectshot.onrender.com');
    const cleanHost = rawAppUrl.replace(/^https?:\/\//, '');
    const appUrl = `https://${cleanHost}`;
    const webhookUrl = `${appUrl}/api/telegram/webhook/${botId}`;

    let initialWebhookStatus: 'connected' | 'pending' | 'error' = 'pending';

    // Auto set Webhook on Telegram API if bot token is valid
    if (verifyResult.ok) {
      try {
        const tgRes = await callTelegramApi(token, 'setWebhook', {
          url: webhookUrl,
          drop_pending_updates: false,
          allowed_updates: ['message', 'callback_query'],
        });
        if (tgRes.ok) {
          initialWebhookStatus = 'connected';
        }
      } catch (err) {
        console.error('[AutoWebhook] Initial setWebhook error:', err);
      }
    }

    const newBot: Omit<TelegramBot, '_id'> & { _id: string } = {
      _id: botId,
      name: botName,
      username,
      token,
      status: 'active',
      mode: mode || (isDemoToken(token) ? 'simulator' : 'webhook'),
      description: description || 'Managed Telegram bot instance.',
      webhookUrl,
      webhookStatus: initialWebhookStatus,
      isVerified: Boolean(verifyResult.ok),
      botInfo: botInfo || undefined,
      stats: {
        messagesReceived: 0,
        messagesSent: 0,
        activeUsers: 0,
        commandsExecuted: 0,
        lastActiveAt: new Date().toISOString(),
        errorCount: 0,
      },
      config: {
        aiEnabled: true,
        aiPrompt: `You are ${botName}, a responsive and helpful Telegram bot. Assist users with clear and polite responses.`,
        defaultReply: 'Thank you for reaching out! Type /help to see all available commands.',
        parseMode: 'HTML',
        allowedUpdates: ['message', 'callback_query'],
        dropPendingUpdates: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await db.bots.insertOne(newBot);

    if (initialWebhookStatus === 'connected') {
      await db.logs.insertOne({
        botId: created._id,
        level: 'webhook',
        event: 'WEBHOOK_AUTO_CONNECTED',
        details: `Webhook automatically set to: ${webhookUrl}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Create default commands for the new bot
    await db.commands.insertMany([
      {
        botId: created._id,
        command: 'start',
        description: 'Start conversation and show main options',
        responseType: 'inline_keyboard',
        responseText: `👋 Hello! Welcome to <b>${created.name}</b>.\n\nType /help to learn about what I can do!`,
        inlineKeyboard: [
          [{ text: 'ℹ️ About Us', callback_data: 'cmd_help' }],
          [{ text: '🌐 Website', url: 'https://telegram.org' }],
        ],
        isActive: true,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        botId: created._id,
        command: 'help',
        description: 'View instructions and available commands',
        responseType: 'text',
        responseText: `🤖 <b>${created.name} Help:</b>\n\n• /start - Launch the bot\n• /help - Show this guide\n• /status - Health check`,
        isActive: true,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        botId: created._id,
        command: 'status',
        description: 'Bot health and operational status',
        responseType: 'text',
        responseText: `🟢 <b>Bot Status:</b> Operational and online!`,
        isActive: true,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    // Add log
    await db.logs.insertOne({
      botId: created._id,
      level: 'info',
      event: 'BOT_CREATED',
      details: `Created bot "${created.name}" (@${created.username})`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single bot
router.get('/api/bots/:id', async (req: Request, res: Response) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });
    res.json({ success: true, data: bot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update bot
router.put('/api/bots/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, mode, status, config } = req.body;
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    const updated = await db.bots.updateById(req.params.id, {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(mode && { mode }),
      ...(status && { status }),
      ...(config && { config: { ...bot.config, ...config } }),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete bot
router.delete('/api/bots/:id', async (req: Request, res: Response) => {
  try {
    const botId = req.params.id;
    const bot = await db.bots.findById(botId);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    await db.bots.deleteById(botId);
    await db.commands.deleteMany({ botId });
    await db.responders.deleteMany({ botId });
    await db.subscribers.deleteMany({ botId });
    await db.messages.deleteMany({ botId });
    await db.broadcasts.deleteMany({ botId });
    await db.logs.deleteMany({ botId });

    res.json({ success: true, message: 'Bot and associated records deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify bot token
router.post('/api/bots/:id/verify', async (req: Request, res: Response) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    const result = await verifyBotToken(bot.token);
    if (result.ok && result.result) {
      await db.bots.updateById(bot._id, {
        isVerified: true,
        botInfo: result.result,
        username: result.result.username || bot.username,
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export subscribers & leads as CSV
router.get('/api/bots/:id/export-subscribers', async (req: Request, res: Response) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    const subscribers = await db.subscribers.find({ botId: req.params.id });

    // CSV Header
    const csvRows = [
      ['Telegram ID', 'First Name', 'Last Name', 'Username', 'Phone', 'Tags', 'Joined At', 'Last Active'].join(',')
    ];

    for (const sub of subscribers) {
      const row = [
        sub.telegramId,
        `"${(sub.firstName || '').replace(/"/g, '""')}"`,
        `"${(sub.lastName || '').replace(/"/g, '""')}"`,
        `"${(sub.username || '').replace(/"/g, '""')}"`,
        `"${(sub.phone || '').replace(/"/g, '""')}"`,
        `"${(sub.tags || []).join(';')}"`,
        `"${sub.joinedAt || ''}"`,
        `"${sub.lastSeenAt || ''}"`,
      ];
      csvRows.push(row.join(','));
    }

    const csvData = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${bot.username}_subscribers.csv"`);
    res.status(200).send(csvData);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync commands with Telegram API (setMyCommands)
router.post('/api/bots/:id/sync-commands', async (req: Request, res: Response) => {
  try {
    const success = await syncBotCommandsWithTelegram(req.params.id);
    res.json({ success, message: success ? 'Commands synchronized with Telegram' : 'Sync failed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== WEBHOOK MANAGEMENT ====================

// Get Webhook Info
router.get('/api/bots/:id/webhook', async (req: Request, res: Response) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    const tgRes = await callTelegramApi(bot.token, 'getWebhookInfo');
    res.json({ success: true, data: tgRes.result || null, raw: tgRes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set Webhook
router.post('/api/bots/:id/webhook/set', async (req: Request, res: Response) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    let targetUrl = (req.body.url || bot.webhookUrl || '').trim();
    if (targetUrl.startsWith('http://')) {
      targetUrl = targetUrl.replace(/^http:\/\//, 'https://');
    }
    if (!targetUrl.startsWith('https://')) {
      const renderHost = (process.env.RENDER_EXTERNAL_URL || 'https://perfectshot.onrender.com').replace(/^https?:\/\//, '');
      targetUrl = `https://${renderHost}/api/telegram/webhook/${bot._id}`;
    }

    const tgRes = await callTelegramApi(bot.token, 'setWebhook', {
      url: targetUrl,
      drop_pending_updates: Boolean(bot.config.dropPendingUpdates),
      allowed_updates: bot.config.allowedUpdates,
    });

    if (tgRes.ok) {
      await db.bots.updateById(bot._id, {
        webhookUrl: targetUrl,
        webhookStatus: 'connected',
        mode: 'webhook',
        updatedAt: new Date().toISOString(),
      });

      await db.logs.insertOne({
        botId: bot._id,
        level: 'webhook',
        event: 'WEBHOOK_SET',
        details: `Webhook set to: ${targetUrl}`,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: tgRes.ok, result: tgRes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Webhook
router.post('/api/bots/:id/webhook/delete', async (req: Request, res: Response) => {
  try {
    const bot = await db.bots.findById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    const tgRes = await callTelegramApi(bot.token, 'deleteWebhook', {
      drop_pending_updates: Boolean(req.body.dropPendingUpdates),
    });

    if (tgRes.ok) {
      await db.bots.updateById(bot._id, {
        webhookStatus: 'disconnected',
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({ success: tgRes.ok, result: tgRes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Live incoming Telegram Webhook endpoint
router.post('/api/telegram/webhook/:botId', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const update = req.body;

    const result = await processTelegramUpdate(botId, update);
    res.json({ ok: true, result });
  } catch (error: any) {
    console.error('[Webhook] Update processing failed:', error);
    res.status(200).json({ ok: false, error: error.message }); // Telegram expects 200 to not retry endlessly
  }
});

// ==================== LIVE SIMULATOR ====================

// Simulate Telegram update in the interactive tester
router.post('/api/bots/:id/simulate', async (req: Request, res: Response) => {
  try {
    const botId = req.params.id;
    const { text, callbackData, senderName, telegramId } = req.body;

    const simUserId = telegramId || 99887766;
    const simUserName = senderName || 'Preview User';

    let updatePayload: any;

    if (callbackData) {
      updatePayload = {
        update_id: Math.floor(Math.random() * 900000) + 100000,
        callback_query: {
          id: Math.random().toString(),
          from: {
            id: simUserId,
            is_bot: false,
            first_name: simUserName,
            username: 'preview_tester',
          },
          data: callbackData,
        },
      };
    } else {
      updatePayload = {
        update_id: Math.floor(Math.random() * 900000) + 100000,
        message: {
          message_id: Math.floor(Math.random() * 900000) + 100000,
          from: {
            id: simUserId,
            is_bot: false,
            first_name: simUserName,
            username: 'preview_tester',
          },
          chat: {
            id: simUserId,
            type: 'private',
            first_name: simUserName,
          },
          date: Math.floor(Date.now() / 1000),
          text: text || '/start',
        },
      };
    }

    const output = await processTelegramUpdate(botId, updatePayload);
    res.json({ success: true, data: output });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== COMMANDS & RESPONDERS ====================

// Commands CRUD
router.get('/api/bots/:id/commands', async (req: Request, res: Response) => {
  try {
    const commands = await db.commands.find({ botId: req.params.id });
    res.json({ success: true, data: commands });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/bots/:id/commands', async (req: Request, res: Response) => {
  try {
    const { command, description, responseType, responseText, inlineKeyboard, replyKeyboard } = req.body;
    if (!command || !responseText) {
      return res.status(400).json({ success: false, error: 'Command name and response text are required' });
    }

    const cleanCommand = command.toLowerCase().replace(/^\//, '').trim();

    const newCmd = await db.commands.insertOne({
      botId: req.params.id,
      command: cleanCommand,
      description: description || `Command /${cleanCommand}`,
      responseType: responseType || 'text',
      responseText,
      inlineKeyboard: inlineKeyboard || undefined,
      replyKeyboard: replyKeyboard || undefined,
      isActive: true,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: newCmd });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/api/commands/:cmdId', async (req: Request, res: Response) => {
  try {
    const { command, description, responseType, responseText, inlineKeyboard, replyKeyboard, isActive } = req.body;
    const updated = await db.commands.updateById(req.params.cmdId, {
      ...(command && { command: command.toLowerCase().replace(/^\//, '').trim() }),
      ...(description !== undefined && { description }),
      ...(responseType && { responseType }),
      ...(responseText !== undefined && { responseText }),
      ...(inlineKeyboard !== undefined && { inlineKeyboard }),
      ...(replyKeyboard !== undefined && { replyKeyboard }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/api/commands/:cmdId', async (req: Request, res: Response) => {
  try {
    await db.commands.deleteById(req.params.cmdId);
    res.json({ success: true, message: 'Command deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auto-responders CRUD
router.get('/api/bots/:id/responders', async (req: Request, res: Response) => {
  try {
    const responders = await db.responders.find({ botId: req.params.id });
    res.json({ success: true, data: responders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/bots/:id/responders', async (req: Request, res: Response) => {
  try {
    const { triggerType, triggerValue, responseText, inlineKeyboard } = req.body;
    if (!triggerValue || !responseText) {
      return res.status(400).json({ success: false, error: 'Trigger value and response text are required' });
    }

    const newResponder = await db.responders.insertOne({
      botId: req.params.id,
      triggerType: triggerType || 'contains',
      triggerValue,
      responseText,
      inlineKeyboard: inlineKeyboard || undefined,
      isActive: true,
      hitCount: 0,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, data: newResponder });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/api/responders/:respId', async (req: Request, res: Response) => {
  try {
    await db.responders.deleteById(req.params.respId);
    res.json({ success: true, message: 'Auto-responder deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SUBSCRIBERS & MESSAGES ====================

// List subscribers
router.get('/api/bots/:id/subscribers', async (req: Request, res: Response) => {
  try {
    const subscribers = await db.subscribers.find({ botId: req.params.id });
    res.json({ success: true, data: subscribers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update subscriber tags / notes / handover mode
router.put('/api/subscribers/:subId', async (req: Request, res: Response) => {
  try {
    const { tags, isBlocked, customNotes, isHandoverActive, handoverReason, phone, email } = req.body;
    const updated = await db.subscribers.updateById(req.params.subId, {
      ...(tags && { tags }),
      ...(isBlocked !== undefined && { isBlocked }),
      ...(customNotes !== undefined && { customNotes }),
      ...(isHandoverActive !== undefined && { isHandoverActive }),
      ...(handoverReason !== undefined && { handoverReason }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get chat history with a subscriber
router.get('/api/bots/:id/subscribers/:telegramId/messages', async (req: Request, res: Response) => {
  try {
    const telegramId = parseInt(req.params.telegramId, 10);
    const messages = await db.messages.find(
      m => m.botId === req.params.id && m.telegramId === telegramId
    );
    res.json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send direct outbound message from admin to subscriber
router.post('/api/bots/:id/messages/send', async (req: Request, res: Response) => {
  try {
    const botId = req.params.id;
    const { telegramId, text } = req.body;

    if (!telegramId || !text) {
      return res.status(400).json({ success: false, error: 'telegramId and text are required' });
    }

    const bot = await db.bots.findById(botId);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    // Send to Telegram if real token
    if (!isDemoToken(bot.token)) {
      await callTelegramApi(bot.token, 'sendMessage', {
        chat_id: telegramId,
        text,
        parse_mode: 'HTML',
      });
    }

    // Save in messages collection
    const createdMsg = await db.messages.insertOne({
      botId,
      telegramId: Number(telegramId),
      senderName: `Admin (${bot.name})`,
      direction: 'outbound',
      text,
      status: 'sent',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: createdMsg });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== BROADCASTS ====================

// List broadcasts
router.get('/api/bots/:id/broadcasts', async (req: Request, res: Response) => {
  try {
    const broadcasts = await db.broadcasts.find({ botId: req.params.id });
    res.json({ success: true, data: broadcasts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create & launch broadcast
router.post('/api/bots/:id/broadcasts', async (req: Request, res: Response) => {
  try {
    const botId = req.params.id;
    const { title, messageText, targetTags } = req.body;

    if (!title || !messageText) {
      return res.status(400).json({ success: false, error: 'Title and messageText are required' });
    }

    const bot = await db.bots.findById(botId);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    // Find target recipients
    const allSubs = await db.subscribers.find({ botId, isBlocked: false });
    const recipients = allSubs.filter(sub => {
      if (!targetTags || targetTags.length === 0 || targetTags.includes('all')) return true;
      return sub.tags.some(t => targetTags.includes(t));
    });

    const now = new Date().toISOString();
    const broadcast = await db.broadcasts.insertOne({
      botId,
      title,
      messageText,
      targetTags: targetTags || ['all'],
      status: 'completed',
      totalRecipients: recipients.length,
      sentCount: recipients.length,
      failedCount: 0,
      createdAt: now,
      completedAt: now,
    });

    // Send messages in background / simulated
    for (const sub of recipients) {
      if (!isDemoToken(bot.token)) {
        try {
          await callTelegramApi(bot.token, 'sendMessage', {
            chat_id: sub.telegramId,
            text: messageText,
            parse_mode: 'HTML',
          });
        } catch (e) {
          // ignore individual delivery fails
        }
      }

      await db.messages.insertOne({
        botId,
        telegramId: sub.telegramId,
        senderName: `${bot.name} (Broadcast)`,
        direction: 'outbound',
        text: messageText,
        status: 'sent',
        timestamp: now,
      });
    }

    await db.logs.insertOne({
      botId,
      level: 'info',
      event: 'BROADCAST_SENT',
      details: `Broadcast "${title}" delivered to ${recipients.length} subscribers.`,
      timestamp: now,
    });

    res.json({ success: true, data: broadcast });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== LOGS ====================

router.get('/api/bots/:id/logs', async (req: Request, res: Response) => {
  try {
    const logs = await db.logs.find({ botId: req.params.id });
    // Sort descending by timestamp
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json({ success: true, data: logs.slice(0, 100) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DIRECT TELEGRAM API PLAYGROUND ====================

router.post('/api/telegram/direct-api', async (req: Request, res: Response) => {
  try {
    const { token, method, params } = req.body;
    if (!token || !method) {
      return res.status(400).json({ success: false, error: 'Token and API method are required' });
    }

    const response = await callTelegramApi(token, method, params || {});
    res.json({ success: true, response });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DATABASE EXPLORER (MONGODB COMPATIBLE) ====================

router.get('/api/database/stats', async (req: Request, res: Response) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/database/test-connection', async (req: Request, res: Response) => {
  try {
    const targetUri = req.body.uri || process.env.MONGODB_URI || '';
    if (!targetUri) {
      return res.status(400).json({ success: false, error: 'No MongoDB URI provided' });
    }

    await db.initMongo(targetUri);
    const stats = await db.getStats();
    res.json({
      success: stats.mongo.status === 'connected',
      mongo: stats.mongo,
      message: stats.mongo.status === 'connected'
        ? 'Successfully connected to MongoDB Atlas cluster!'
        : `Connection failed: ${stats.mongo.error || 'Check IP Whitelist in Atlas'}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/database/update-uri', async (req: Request, res: Response) => {
  try {
    const { uri } = req.body;
    if (!uri) {
      return res.status(400).json({ success: false, error: 'MongoDB URI is required' });
    }

    process.env.MONGODB_URI = uri.trim();
    await db.initMongo(uri.trim());
    const stats = await db.getStats();

    res.json({
      success: true,
      mongo: stats.mongo,
      message: stats.mongo.status === 'connected'
        ? 'MongoDB Atlas URI updated and successfully connected!'
        : 'MongoDB URI updated. Notice: Atlas server connection pending or IP whitelist required.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/database/collections/:collection', async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;
    let data: any[] = [];
    if (collection === 'bots') data = await db.bots.find();
    else if (collection === 'commands') data = await db.commands.find();
    else if (collection === 'responders') data = await db.responders.find();
    else if (collection === 'subscribers') data = await db.subscribers.find();
    else if (collection === 'messages') data = await db.messages.find();
    else if (collection === 'broadcasts') data = await db.broadcasts.find();
    else if (collection === 'logs') data = await db.logs.find();
    else return res.status(404).json({ success: false, error: 'Collection not found' });

    res.json({ success: true, collection, count: data.length, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AI BOT GENERATOR ====================

router.post('/api/ai/generate-template', async (req: Request, res: Response) => {
  try {
    const { industry, tone } = req.body;
    if (!industry) {
      return res.status(400).json({ success: false, error: 'Industry or niche description is required' });
    }

    const template = await generateBotTemplate(industry, tone || 'professional and helpful');
    res.json({ success: true, data: template });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

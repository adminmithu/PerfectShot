import { db } from './db';
import { TelegramBot, BotCommand, AutoResponder, BotSubscriber, BotMessage } from './types';
import { generateBotResponse } from './geminiService';
import { emitTerminalLog } from './socket';

export interface TelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export function isDemoToken(token: string): boolean {
  return !token || token.trim() === '';
}

export async function callTelegramApi<T = any>(
  token: string,
  method: string,
  params: Record<string, any> = {}
): Promise<TelegramApiResponse<T>> {
  // Demo token simulation
  if (isDemoToken(token)) {
    return handleDemoTelegramApi<T>(method, params);
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = (await response.json()) as TelegramApiResponse<T>;
    return data;
  } catch (error: any) {
    console.error(`[TelegramAPI] Request failed for ${method}:`, error);
    return {
      ok: false,
      description: error.message || 'Network error connecting to Telegram API',
      error_code: 500,
    };
  }
}

function handleDemoTelegramApi<T>(
  method: string,
  params: Record<string, any>
): TelegramApiResponse<T> {
  switch (method) {
    case 'getMe':
      return {
        ok: true,
        result: {
          id: 1234567890,
          is_bot: true,
          first_name: 'Nexus Support AI',
          username: 'nexus_support_ai_bot',
          can_join_groups: true,
          can_read_all_group_messages: false,
          supports_inline_queries: true,
        } as unknown as T,
      };

    case 'getWebhookInfo':
      return {
        ok: true,
        result: {
          url: params.url || 'https://telemanager-app.vercel.app/api/telegram/webhook/bot_nexus_demo',
          has_custom_certificate: false,
          pending_update_count: 0,
          ip_address: '149.154.167.220',
          last_error_date: undefined,
          last_error_message: undefined,
          max_connections: 40,
          allowed_updates: ['message', 'callback_query'],
        } as unknown as T,
      };

    case 'setWebhook':
      return {
        ok: true,
        result: true as unknown as T,
        description: 'Webhook was set (Simulated mode)',
      };

    case 'deleteWebhook':
      return {
        ok: true,
        result: true as unknown as T,
        description: 'Webhook was deleted (Simulated mode)',
      };

    case 'sendMessage':
      return {
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 900000) + 100000,
          date: Math.floor(Date.now() / 1000),
          chat: { id: params.chat_id, type: 'private' },
          text: params.text,
        } as unknown as T,
      };

    case 'getMyCommands':
      return {
        ok: true,
        result: [
          { command: 'start', description: 'Initialize bot & show welcome' },
          { command: 'help', description: 'List commands & guide' },
          { command: 'pricing', description: 'View subscription plans' },
          { command: 'support', description: 'Open customer ticket' },
          { command: 'status', description: 'System health check' },
        ] as unknown as T,
      };

    case 'setMyCommands':
      return {
        ok: true,
        result: true as unknown as T,
      };

    default:
      return {
        ok: true,
        result: { acknowledged: true, method, params } as unknown as T,
      };
  }
}

export async function verifyBotToken(token: string) {
  const result = await callTelegramApi(token, 'getMe');
  return result;
}

export async function syncBotCommandsWithTelegram(botId: string): Promise<boolean> {
  const bot = await db.bots.findById(botId);
  if (!bot) return false;

  const commands = await db.commands.find({ botId, isActive: true });
  const tgCommands = commands.map(c => ({
    command: c.command.toLowerCase().replace(/^\//, ''),
    description: c.description.slice(0, 256) || 'Bot command',
  }));

  const res = await callTelegramApi(bot.token, 'setMyCommands', { commands: tgCommands });
  return res.ok;
}

// Full Telegram Update Handler (handles both live webhooks and interactive simulator)
export async function processTelegramUpdate(
  botId: string,
  update: any
): Promise<{ replyText?: string; replyMarkup?: any; processed: boolean; command?: string }> {
  let bot = await db.bots.findById(botId);
  if (!bot) {
    bot = await db.bots.findOne(b => 
      b._id === botId ||
      (b.webhookUrl && b.webhookUrl.includes(botId)) ||
      (b.token && b.token.includes(botId)) ||
      b.username === botId
    );
  }
  if (!bot) {
    const allBots = await db.bots.find();
    if (allBots.length > 0) {
      bot = allBots[0];
    }
  }

  if (!bot) {
    return { processed: false, replyText: 'Bot not found in database' };
  }

  // Extract message details (support both regular message and callback query)
  let telegramId = 0;
  let firstName = 'User';
  let lastName = '';
  let username = '';
  let languageCode = 'en';
  let messageText = '';
  let isCallback = false;
  let callbackData = '';

  if (update.message) {
    const msg = update.message;
    telegramId = msg.from?.id || 1000000;
    firstName = msg.from?.first_name || 'Anonymous';
    lastName = msg.from?.last_name || '';
    username = msg.from?.username || '';
    languageCode = msg.from?.language_code || 'en';
    messageText = msg.text || '';
  } else if (update.callback_query) {
    isCallback = true;
    const cb = update.callback_query;
    telegramId = cb.from?.id || 1000000;
    firstName = cb.from?.first_name || 'Anonymous';
    lastName = cb.from?.last_name || '';
    username = cb.from?.username || '';
    callbackData = cb.data || '';
    messageText = `[Button Clicked: ${callbackData}]`;
  } else {
    // Unhandled update type
    return { processed: true, replyText: 'Update acknowledged' };
  }

  const now = new Date().toISOString();

  // 1. Fetch Subscriber
  let subscriber = await db.subscribers.findOne({ botId, telegramId });

  // Extract contact phone number if shared
  if (update.message?.contact?.phone_number && subscriber) {
    const phoneNumber = update.message.contact.phone_number;
    await db.subscribers.updateById(subscriber._id, {
      phone: phoneNumber,
      tags: Array.from(new Set([...(subscriber.tags || []), 'lead_captured', 'phone_provided'])),
    });
    messageText = `[Shared Contact Phone: ${phoneNumber}]`;
  }

  // Upsert Subscriber
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
      tags: ['new_user'],
      joinedAt: now,
      lastSeenAt: now,
      interactionCount: 1,
    });
  } else {
    await db.subscribers.updateById(subscriber._id, {
      lastSeenAt: now,
      interactionCount: (subscriber.interactionCount || 0) + 1,
      firstName: firstName || subscriber.firstName,
      username: username || subscriber.username,
    });
  }

  // 2. Record Inbound Message
  await db.messages.insertOne({
    botId,
    telegramId,
    senderName: `${firstName} ${lastName}`.trim() || username || 'User',
    direction: 'inbound',
    text: messageText,
    updateId: update.update_id,
    messageId: update.message?.message_id,
    status: 'received',
    timestamp: now,
    payload: update,
  });

  emitTerminalLog({
    level: 'webhook',
    event: 'INBOUND_MESSAGE',
    details: `From ${firstName} (@${username || telegramId}): "${messageText || '[Callback/Action]'}"`,
    botId,
    timestamp: now,
  });

  // 2.5 Force Join Channel Gateway Check
  let replyText = '';
  let replyMarkup: any = null;
  let executedCommand: string | undefined;

  const forceJoin = bot.config.forceJoin;
  if (forceJoin?.enabled && forceJoin.channelUsername) {
    const chName = forceJoin.channelUsername.replace(/^@/, '');
    const isVerificationClick = isCallback && callbackData === 'cb_verify_join';

    // Verify chat membership via Telegram API if live token
    let isMember = false;
    if (isDemoToken(bot.token)) {
      // In simulator mode, verification passes on click or if tag exists
      isMember = isVerificationClick || Boolean(subscriber?.tags?.includes('force_join_verified'));
    } else {
      try {
        const checkRes = await callTelegramApi(bot.token, 'getChatMember', {
          chat_id: `@${chName}`,
          user_id: telegramId,
        });
        if (checkRes.ok && checkRes.result) {
          const st = checkRes.result.status;
          isMember = ['creator', 'administrator', 'member'].includes(st);
        }
      } catch (err) {
        console.error('[ForceJoin] getChatMember error:', err);
      }
    }

    if (isMember) {
      if (subscriber && !subscriber.tags?.includes('force_join_verified')) {
        await db.subscribers.updateById(subscriber._id, {
          tags: Array.from(new Set([...(subscriber.tags || []), 'force_join_verified'])),
        });
      }
      if (isVerificationClick) {
        replyText = `✅ <b>Subscription Verified!</b>\n\nWelcome! You now have full access to <b>${bot.name}</b>. Type /help or /start to begin!`;
        replyMarkup = {
          inline_keyboard: [[{ text: '🚀 Get Started', callback_data: 'cmd_start' }]],
        };
      }
    } else {
      // User is NOT joined yet - block access and send Force Join prompt
      replyText =
        forceJoin.customMessage ||
        `⚠️ <b>Access Restricted!</b>\n\nTo use <b>${bot.name}</b>, you must first join our official Telegram channel @${chName}.\n\nAfter joining, click the <b>Verify Membership</b> button below!`;
      replyMarkup = {
        inline_keyboard: [
          [{ text: '📢 Join Official Channel', url: `https://t.me/${chName}` }],
          [{ text: '✅ Verify Membership', callback_data: 'cb_verify_join' }],
        ],
      };
      return { replyText, replyMarkup, processed: true };
    }
  }

  // 2.7 Live Handover Active Check
  if (subscriber?.isHandoverActive && !isCallback) {
    emitTerminalLog({
      level: 'info',
      event: 'LIVE_HANDOVER_MESSAGE',
      details: `Subscriber ${firstName} (@${username || telegramId}) is in Live Handover mode. Pausing AI.`,
      botId,
      timestamp: now,
    });
    return {
      replyText: '🧑‍💻 <b>Live Agent Assigned!</b>\n\nA human support specialist is currently assigned to your chat session. Please wait for an admin to reply.',
      processed: true,
    };
  }

  // 2.8 Human Support Handover Keyword Trigger
  const isHandoverTrigger = ['human', 'agent', 'support', 'live agent', 'talk to human', 'admin'].some(k =>
    messageText.toLowerCase().includes(k)
  );
  if (isHandoverTrigger && subscriber && !subscriber.isHandoverActive) {
    await db.subscribers.updateById(subscriber._id, {
      isHandoverActive: true,
      handoverReason: `Requested via chat: "${messageText.slice(0, 50)}"`,
      tags: Array.from(new Set([...(subscriber.tags || []), 'handover_requested'])),
    });
    emitTerminalLog({
      level: 'warn',
      event: 'LIVE_HANDOVER_REQUESTED',
      details: `User ${firstName} requested human agent takeover. Live mode ENABLED.`,
      botId,
      timestamp: now,
    });
    return {
      replyText: '🔔 <b>Live Support Requested!</b>\n\nYour request has been forwarded to our support team. An admin will connect with you shortly!',
      processed: true,
    };
  }

  // 3. Process Logic: Check Command
  const trimmed = messageText.trim();
  const isCommand = trimmed.startsWith('/');

  if (isCommand) {
    const rawCmd = trimmed.split(' ')[0].replace('/', '').toLowerCase();
    const cmdDoc = await db.commands.findOne({ botId, command: rawCmd, isActive: true });

    if (cmdDoc) {
      executedCommand = rawCmd;
      replyText = cmdDoc.responseText;

      if (cmdDoc.responseType === 'inline_keyboard' && cmdDoc.inlineKeyboard) {
        replyMarkup = { inline_keyboard: cmdDoc.inlineKeyboard };
      } else if (cmdDoc.responseType === 'reply_keyboard' && cmdDoc.replyKeyboard) {
        replyMarkup = {
          keyboard: cmdDoc.replyKeyboard.map(row => row.map(btn => ({ text: btn }))),
          resize_keyboard: true,
          one_time_keyboard: true,
        };
      }

      await db.commands.updateById(cmdDoc._id, {
        usageCount: (cmdDoc.usageCount || 0) + 1,
      });

      emitTerminalLog({
        level: 'info',
        event: 'COMMAND_DISPATCHED',
        details: `Executed /${rawCmd} for user @${username || telegramId}`,
        botId,
        timestamp: now,
      });
    } else {
      // Built-in Dynamic Commands
      if (rawCmd === 'book' || rawCmd === 'appointment') {
        executedCommand = 'book';
        const slots = bot.config.appointmentSlots || ['10:00 AM', '02:00 PM', '04:00 PM', '06:00 PM'];
        replyText = '📅 <b>Select an Appointment Slot:</b>\n\nPlease choose a convenient time slot below for your consultation session:';
        replyMarkup = {
          inline_keyboard: slots.map(slot => [
            { text: `🕒 ${slot}`, callback_data: `book_slot_${slot.replace(/\s+/g, '')}` }
          ]),
        };
      } else if (rawCmd === 'feedback' || rawCmd === 'rate') {
        executedCommand = 'feedback';
        replyText = '⭐️ <b>Rate Your Experience:</b>\n\nHow would you rate your interaction with our bot today?';
        replyMarkup = {
          inline_keyboard: [
            [
              { text: '⭐ 1', callback_data: 'rate_1' },
              { text: '⭐⭐ 2', callback_data: 'rate_2' },
              { text: '⭐⭐⭐ 3', callback_data: 'rate_3' },
              { text: '⭐⭐⭐⭐ 4', callback_data: 'rate_4' },
              { text: '⭐⭐⭐⭐⭐ 5', callback_data: 'rate_5' },
            ]
          ],
        };
      } else if (rawCmd === 'vault' || rawCmd === 'files') {
        executedCommand = 'vault';
        const vaultFiles = bot.config.fileVault || [
          { id: 'f1', name: '📘 Platform User Guide (PDF)', fileUrl: 'https://telegram.org' },
          { id: 'f2', name: '🎁 Exclusive Bonus Resource', fileUrl: 'https://telegram.org' },
        ];
        replyText = '📂 <b>Protected Digital File Vault:</b>\n\nSelect a file below to download instant assets:';
        replyMarkup = {
          inline_keyboard: vaultFiles.map(f => [
            { text: f.name, callback_data: `vault_dl_${f.id}` }
          ]),
        };
      }
    }
  }

  // 4. If callback query from inline button, handle known callbacks
  if (isCallback && !replyText) {
    if (callbackData.startsWith('cmd_')) {
      const targetCmd = callbackData.replace('cmd_', '');
      const cmdDoc = await db.commands.findOne({ botId, command: targetCmd, isActive: true });
      if (cmdDoc) {
        executedCommand = targetCmd;
        replyText = cmdDoc.responseText;
        if (cmdDoc.inlineKeyboard) replyMarkup = { inline_keyboard: cmdDoc.inlineKeyboard };
      }
    } else if (callbackData.startsWith('rate_')) {
      const score = parseInt(callbackData.replace('rate_', ''), 10) || 5;
      if (subscriber) {
        await db.subscribers.updateById(subscriber._id, {
          ratingScore: score,
          tags: Array.from(new Set([...(subscriber.tags || []), `rating_${score}_star`])),
        });
      }
      replyText = `🎉 <b>Thank you for your rating (${'⭐'.repeat(score)})!</b>\n\nYour feedback helps us continuously improve our services.`;
    } else if (callbackData.startsWith('book_slot_')) {
      const slotName = callbackData.replace('book_slot_', '');
      if (subscriber) {
        await db.subscribers.updateById(subscriber._id, {
          bookedSlot: slotName,
          tags: Array.from(new Set([...(subscriber.tags || []), 'appointment_booked'])),
        });
      }
      replyText = `📅 <b>Appointment Confirmed!</b>\n\nYour session has been scheduled for <b>${slotName}</b>. We look forward to speaking with you!`;
    } else if (callbackData.startsWith('vault_dl_')) {
      const fileId = callbackData.replace('vault_dl_', '');
      const fileObj = (bot.config.fileVault || []).find(f => f.id === fileId);
      const url = fileObj?.fileUrl || 'https://telegram.org';
      replyText = `📥 <b>Download Ready:</b> ${fileObj?.name || 'File Asset'}\n\nClick below to access your file:`;
      replyMarkup = {
        inline_keyboard: [[{ text: '⬇️ Download Asset File', url }]],
      };
    } else if (callbackData.startsWith('buy_')) {
      const plan = callbackData.replace('buy_', '').toUpperCase();
      replyText = `🎉 <b>Awesome choice!</b> You selected the <b>${plan}</b> plan.\n\nOur checkout gateway will generate your secure invoice: https://nexus-checkout.example.com?plan=${plan.toLowerCase()}`;
      replyMarkup = {
        inline_keyboard: [
          [{ text: '💳 Complete Payment', url: 'https://telegram.org' }],
          [{ text: '◀️ Back to Plans', callback_data: 'cmd_pricing' }],
        ],
      };
    } else {
      replyText = `Received response for: <code>${callbackData}</code>`;
    }
  }

  // 5. If no command matched, check Auto-Responders
  if (!replyText && !isCallback) {
    const responders = await db.responders.find({ botId, isActive: true });
    for (const r of responders) {
      let match = false;
      const lowerText = messageText.toLowerCase();
      const trigger = r.triggerValue.toLowerCase();

      if (r.triggerType === 'exact' && lowerText === trigger) match = true;
      if (r.triggerType === 'contains' && lowerText.includes(trigger)) match = true;
      if (r.triggerType === 'regex') {
        try {
          const re = new RegExp(r.triggerValue, 'i');
          if (re.test(messageText)) match = true;
        } catch {
          // ignore bad regex
        }
      }

      if (match) {
        replyText = r.responseText;
        if (r.inlineKeyboard) {
          replyMarkup = { inline_keyboard: r.inlineKeyboard };
        }
        await db.responders.updateById(r._id, {
          hitCount: (r.hitCount || 0) + 1,
        });
        break;
      }
    }
  }

  // 6. If still no reply, Fallback to Gemini AI if enabled, or default reply
  if (!replyText) {
    if (bot.config.aiEnabled) {
      replyText = await generateBotResponse(
        bot.config.aiPrompt || 'You are a helpful Telegram Assistant.',
        messageText,
        firstName,
        bot.config.knowledgeBase
      );
    } else {
      replyText =
        bot.config.defaultReply ||
        `Thank you for your message! Use /help to see all available commands.`;
    }
  }

  // 7. If this is a real bot (not demo), transmit outbound reply to Telegram API
  if (!isDemoToken(bot.token)) {
    try {
      await callTelegramApi(bot.token, 'sendMessage', {
        chat_id: telegramId,
        text: replyText,
        parse_mode: bot.config.parseMode || 'HTML',
        reply_markup: replyMarkup || undefined,
      });
    } catch (err) {
      console.error('[TelegramService] Outbound send error:', err);
    }
  }

  // 8. Record Outbound Message in DB
  await db.messages.insertOne({
    botId,
    telegramId,
    senderName: bot.name,
    direction: 'outbound',
    text: replyText,
    status: 'sent',
    timestamp: new Date().toISOString(),
    replyMarkup,
  });

  emitTerminalLog({
    level: 'info',
    event: 'OUTBOUND_DISPATCHED',
    details: `Sent reply to ${telegramId}: "${replyText.substring(0, 45)}..."`,
    botId,
    timestamp: new Date().toISOString(),
  });

  // 9. Update Bot Statistics
  const newStats = {
    ...bot.stats,
    messagesReceived: (bot.stats?.messagesReceived || 0) + 1,
    messagesSent: (bot.stats?.messagesSent || 0) + 1,
    commandsExecuted: (bot.stats?.commandsExecuted || 0) + (executedCommand ? 1 : 0),
    lastActiveAt: new Date().toISOString(),
  };

  await db.bots.updateById(bot._id, {
    stats: newStats,
    updatedAt: new Date().toISOString(),
  });

  // 10. Audit Log
  await db.logs.insertOne({
    botId,
    level: 'info',
    event: executedCommand ? `COMMAND_${executedCommand.toUpperCase()}` : 'MESSAGE_PROCESSED',
    details: `User ${firstName} (@${username || telegramId}): "${messageText.slice(0, 40)}" -> "${replyText.slice(0, 40)}"`,
    timestamp: new Date().toISOString(),
  });

  return {
    replyText,
    replyMarkup,
    processed: true,
    command: executedCommand,
  };
}

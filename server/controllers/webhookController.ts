import { Request, Response } from 'express';
import { db } from '../db';
import { callTelegramApi, isDemoToken, TelegramApiResponse } from '../telegramService';
import { generateBotResponse } from '../geminiService';
import { emitTerminalLog } from '../socket';

/**
 * Verifies if user has joined the mandatory Telegram channel (Force Join feature)
 */
export async function checkChannelMembership(
  token: string,
  channelId: string,
  userId: number
): Promise<{ isMember: boolean; status?: string; error?: string }> {
  if (!channelId || isDemoToken(token)) {
    // In demo or if not configured, pass check
    return { isMember: true, status: 'member' };
  }

  try {
    const res: TelegramApiResponse<any> = await callTelegramApi(token, 'getChatMember', {
      chat_id: channelId,
      user_id: userId,
    });

    if (!res.ok) {
      // If bot is not an admin in that channel or channel not found
      return { isMember: false, error: res.description || 'Channel check failed' };
    }

    const memberStatus = res.result?.status;
    const allowedStatuses = ['creator', 'administrator', 'member', 'restricted'];
    const isMember = allowedStatuses.includes(memberStatus);

    return { isMember, status: memberStatus };
  } catch (err: any) {
    console.error('[ForceJoin] Membership check exception:', err);
    return { isMember: false, error: err.message };
  }
}

/**
 * Handle incoming Webhook updates from Telegram
 */
export async function handleIncomingWebhook(req: Request, res: Response) {
  const { botId } = req.params;
  const update = req.body;

  // Immediate 200 OK acknowledgment to Telegram servers
  res.status(200).json({ ok: true });

  const now = new Date().toISOString();

  try {
    const bot = await db.bots.findById(botId);
    if (!bot || bot.status !== 'active') {
      emitTerminalLog({
        level: 'warn',
        event: 'WEBHOOK_IGNORED',
        details: `Update received for inactive or missing bot: ${botId}`,
        botId,
        timestamp: now,
      });
      return;
    }

    // Extract Message or Callback Query
    const message = update.message || update.edited_message;
    const callbackQuery = update.callback_query;

    const fromUser = message?.from || callbackQuery?.from;
    const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;
    const messageText = message?.text || (callbackQuery ? callbackQuery.data : '');
    const callbackData = callbackQuery?.data || '';

    if (!chatId || !fromUser) {
      emitTerminalLog({
        level: 'info',
        event: 'NON_MESSAGE_UPDATE',
        details: `Received non-message update (update_id: ${update.update_id})`,
        botId,
        botName: bot.name,
        timestamp: now,
      });
      return;
    }

    const telegramId = fromUser.id;
    const firstName = fromUser.first_name || 'User';
    const lastName = fromUser.last_name || '';
    const username = fromUser.username || '';

    emitTerminalLog({
      level: 'webhook',
      event: 'INCOMING_UPDATE',
      details: `From @${username || telegramId} (${firstName}): "${messageText || '[Media/Callback]'}"`,
      botId,
      botName: bot.name,
      timestamp: now,
      payload: update,
    });

    // 1. Upsert Bot Subscriber CRM record
    let subscriber = await db.subscribers.findOne({ botId, telegramId });
    if (!subscriber) {
      subscriber = await db.subscribers.insertOne({
        botId,
        telegramId,
        firstName,
        lastName,
        username,
        languageCode: fromUser.language_code || 'en',
        isBot: fromUser.is_bot || false,
        isBlocked: false,
        tags: ['new_subscriber'],
        joinedAt: now,
        lastSeenAt: now,
        interactionCount: 1,
      });
      emitTerminalLog({
        level: 'info',
        event: 'NEW_SUBSCRIBER',
        details: `Registered new subscriber @${username || telegramId} in database`,
        botId,
        botName: bot.name,
        timestamp: now,
      });
    } else {
      if (subscriber.isBlocked) {
        emitTerminalLog({
          level: 'warn',
          event: 'BLOCKED_USER_DROPPED',
          details: `Ignored message from blocked user @${username || telegramId}`,
          botId,
          botName: bot.name,
          timestamp: now,
        });
        return;
      }
      await db.subscribers.updateById(subscriber._id, {
        lastSeenAt: now,
        interactionCount: (subscriber.interactionCount || 0) + 1,
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
      messageId: message?.message_id,
      status: 'received',
      timestamp: now,
    });

    // 3. Force Join Channel Check (if configured)
    const forceJoinChannel = (bot as any).forceJoinChannelId;
    const forceJoinLink = (bot as any).forceJoinChannelLink;

    if (forceJoinChannel) {
      const membership = await checkChannelMembership(bot.token, forceJoinChannel, telegramId);

      // Handle "Verify Membership" button callback
      if (callbackData === 'check_channel_join') {
        if (membership.isMember) {
          await callTelegramApi(bot.token, 'answerCallbackQuery', {
            callback_query_id: callbackQuery.id,
            text: '✅ Membership verified! You can now use the bot.',
            show_alert: true,
          });
          // Continue to welcome message
        } else {
          await callTelegramApi(bot.token, 'answerCallbackQuery', {
            callback_query_id: callbackQuery.id,
            text: '❌ You have not joined the channel yet. Please join and try again!',
            show_alert: true,
          });
          return;
        }
      } else if (!membership.isMember) {
        emitTerminalLog({
          level: 'warn',
          event: 'FORCE_JOIN_BLOCKED',
          details: `User ${telegramId} blocked by Force Join Gate (${forceJoinChannel})`,
          botId,
          botName: bot.name,
          timestamp: now,
        });

        const alertText =
          (bot as any).forceJoinAlertText ||
          `⚠️ <b>Channel Membership Required</b>\n\nTo access this bot, you must join our official channel:\n${forceJoinLink || forceJoinChannel}`;

        await callTelegramApi(bot.token, 'sendMessage', {
          chat_id: chatId,
          text: alertText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📢 Join Official Channel', url: forceJoinLink || `https://t.me/${forceJoinChannel.replace('@', '')}` }],
              [{ text: '🔄 Verify Membership', callback_data: 'check_channel_join' }],
            ],
          },
        });
        return;
      }
    }

    // 4. Command Router & Auto-Replies
    let replyText = '';
    let replyMarkup: any = null;
    let commandMatched = false;

    const trimmed = (messageText || '').trim();
    const isCommand = trimmed.startsWith('/');

    if (isCommand) {
      const rawCmd = trimmed.split(' ')[0].replace('/', '').toLowerCase();
      const cmdDoc = await db.commands.findOne({ botId, command: rawCmd, isActive: true });

      if (cmdDoc) {
        commandMatched = true;
        replyText = cmdDoc.responseText;

        if (cmdDoc.responseType === 'inline_keyboard' && cmdDoc.inlineKeyboard) {
          replyMarkup = { inline_keyboard: cmdDoc.inlineKeyboard };
        } else if (cmdDoc.responseType === 'reply_keyboard' && cmdDoc.replyKeyboard) {
          replyMarkup = {
            keyboard: cmdDoc.replyKeyboard.map((row: any[]) => row.map(btn => ({ text: btn }))),
            resize_keyboard: true,
            one_time_keyboard: true,
          };
        }

        await db.commands.updateById(cmdDoc._id, {
          usageCount: (cmdDoc.usageCount || 0) + 1,
        });

        emitTerminalLog({
          level: 'info',
          event: 'COMMAND_EXECUTED',
          details: `/${rawCmd} triggered by @${username || telegramId}`,
          botId,
          botName: bot.name,
          timestamp: now,
        });
      }
    }

    // 5. Check Auto-Responders
    if (!replyText && !callbackQuery) {
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
          } catch {}
        }

        if (match) {
          replyText = r.responseText;
          if (r.inlineKeyboard) {
            replyMarkup = { inline_keyboard: r.inlineKeyboard };
          }
          await db.responders.updateById(r._id, { hitCount: (r.hitCount || 0) + 1 });

          emitTerminalLog({
            level: 'info',
            event: 'AUTOREPLY_TRIGGERED',
            details: `Matched keyword "${r.triggerValue}" (${r.triggerType})`,
            botId,
            botName: bot.name,
            timestamp: now,
          });
          break;
        }
      }
    }

    // 6. Gemini AI or Fallback default reply
    if (!replyText && !callbackQuery) {
      if (bot.config?.aiEnabled) {
        emitTerminalLog({
          level: 'info',
          event: 'AI_FALLBACK_ENGAGED',
          details: `Invoking Gemini AI for message "${messageText.substring(0, 30)}..."`,
          botId,
          botName: bot.name,
          timestamp: now,
        });
        replyText = await generateBotResponse(
          bot.config.aiPrompt || 'You are a helpful Telegram assistant.',
          messageText,
          firstName
        );
      } else {
        replyText =
          bot.config?.defaultReply ||
          'Thank you for reaching out! Type /help to view available commands.';
      }
    }

    // 7. Transmit Outbound Reply
    if (replyText) {
      if (!isDemoToken(bot.token)) {
        const sendResult = await callTelegramApi(bot.token, 'sendMessage', {
          chat_id: chatId,
          text: replyText,
          parse_mode: bot.config?.parseMode || 'HTML',
          reply_markup: replyMarkup || undefined,
        });

        if (!sendResult.ok) {
          emitTerminalLog({
            level: 'error',
            event: 'TELEGRAM_SEND_FAILED',
            details: `Failed to deliver message: ${sendResult.description}`,
            botId,
            botName: bot.name,
            timestamp: now,
          });
        } else {
          emitTerminalLog({
            level: 'info',
            event: 'MESSAGE_SENT',
            details: `Delivered response to @${username || telegramId} (${replyText.length} chars)`,
            botId,
            botName: bot.name,
            timestamp: now,
          });
        }
      } else {
        emitTerminalLog({
          level: 'info',
          event: 'DEMO_REPLY_SIMULATED',
          details: `Generated reply: "${replyText.substring(0, 50)}..."`,
          botId,
          botName: bot.name,
          timestamp: now,
        });
      }

      // Record outbound in DB
      await db.messages.insertOne({
        botId,
        telegramId,
        senderName: bot.name,
        direction: 'outbound',
        text: replyText,
        status: 'sent',
        timestamp: now,
        replyMarkup,
      });

      // Update bot stats
      await db.bots.updateById(bot._id, {
        stats: {
          ...bot.stats,
          messagesReceived: (bot.stats?.messagesReceived || 0) + 1,
          messagesSent: (bot.stats?.messagesSent || 0) + 1,
          lastActiveAt: now,
        },
      });
    }
  } catch (error: any) {
    console.error('[WebhookController] Processing error:', error);
    emitTerminalLog({
      level: 'error',
      event: 'WEBHOOK_EXCEPTION',
      details: error.message || 'Unknown processing error',
      botId,
      timestamp: now,
    });
  }
}

/**
 * Controller to Activate Webhook with Telegram API
 */
export async function setWebhookController(req: Request, res: Response) {
  try {
    const { botId } = req.params;
    const bot = await db.bots.findById(botId);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const targetWebhookUrl = req.body.url || `${appUrl}/api/telegram/webhook/${botId}`;

    const tgRes = await callTelegramApi(bot.token, 'setWebhook', {
      url: targetWebhookUrl,
      drop_pending_updates: Boolean(bot.config?.dropPendingUpdates),
      allowed_updates: bot.config?.allowedUpdates || ['message', 'callback_query'],
      max_connections: 40,
    });

    if (tgRes.ok) {
      await db.bots.updateById(bot._id, {
        webhookUrl: targetWebhookUrl,
        webhookStatus: 'connected',
        mode: 'webhook',
        status: 'active',
        updatedAt: new Date().toISOString(),
      });

      emitTerminalLog({
        level: 'webhook',
        event: 'WEBHOOK_ACTIVATED',
        details: `Successfully set Telegram webhook to: ${targetWebhookUrl}`,
        botId: bot._id,
        botName: bot.name,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: tgRes.ok, result: tgRes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Controller to Remove/Stop Webhook
 */
export async function deleteWebhookController(req: Request, res: Response) {
  try {
    const { botId } = req.params;
    const bot = await db.bots.findById(botId);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });

    const tgRes = await callTelegramApi(bot.token, 'deleteWebhook', {
      drop_pending_updates: Boolean(req.body.dropPendingUpdates),
    });

    if (tgRes.ok) {
      await db.bots.updateById(bot._id, {
        webhookStatus: 'disconnected',
        updatedAt: new Date().toISOString(),
      });

      emitTerminalLog({
        level: 'webhook',
        event: 'WEBHOOK_STOPPED',
        details: 'Deleted webhook on Telegram API servers.',
        botId: bot._id,
        botName: bot.name,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: tgRes.ok, result: tgRes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

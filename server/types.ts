export interface TelegramBotStats {
  messagesReceived: number;
  messagesSent: number;
  activeUsers: number;
  commandsExecuted: number;
  lastActiveAt: string | null;
  errorCount: number;
}

export interface TelegramBotConfig {
  aiEnabled: boolean;
  aiPrompt: string;
  defaultReply: string;
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2';
  allowedUpdates: string[];
  dropPendingUpdates: boolean;
  forceJoin?: {
    enabled: boolean;
    channelUsername: string;
    customMessage?: string;
  };
  knowledgeBase?: string;
  leadCapture?: {
    enabled: boolean;
    askPhone: boolean;
    welcomePrompt?: string;
  };
  dripCampaigns?: Array<{
    id: string;
    delayMinutes: number;
    title: string;
    messageText: string;
    active: boolean;
  }>;
  multiLang?: {
    enabled: boolean;
    defaultLang: string;
  };
  appointmentSlots?: string[];
  fileVault?: Array<{
    id: string;
    name: string;
    fileUrl: string;
    accessCode?: string;
    description?: string;
  }>;
}

export interface TelegramBot {
  _id: string;
  name: string;
  username: string;
  token: string;
  status: 'active' | 'inactive' | 'error';
  mode: 'webhook' | 'polling' | 'simulator';
  description: string;
  webhookUrl: string;
  webhookStatus: 'connected' | 'disconnected' | 'error' | 'pending';
  webhookLastError?: string;
  webhookPendingUpdates?: number;
  isVerified: boolean;
  botInfo?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups: boolean;
    can_read_all_group_messages: boolean;
    supports_inline_queries: boolean;
  };
  stats: TelegramBotStats;
  config: TelegramBotConfig;
  createdAt: string;
  updatedAt: string;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface BotCommand {
  _id: string;
  botId: string;
  command: string; // e.g. "start", "help"
  description: string;
  responseType: 'text' | 'inline_keyboard' | 'reply_keyboard' | 'ai';
  responseText: string;
  inlineKeyboard?: InlineKeyboardButton[][];
  replyKeyboard?: string[][];
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutoResponder {
  _id: string;
  botId: string;
  triggerType: 'exact' | 'contains' | 'regex' | 'ai';
  triggerValue: string;
  responseText: string;
  inlineKeyboard?: InlineKeyboardButton[][];
  isActive: boolean;
  hitCount: number;
  createdAt: string;
}

export interface BotSubscriber {
  _id: string;
  botId: string;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
  email?: string;
  languageCode?: string;
  isBot: boolean;
  isBlocked: boolean;
  tags: string[];
  joinedAt: string;
  lastSeenAt: string;
  interactionCount: number;
  customNotes?: string;
  isHandoverActive?: boolean;
  handoverReason?: string;
  ratingScore?: number;
  ratingComment?: string;
  bookedSlot?: string;
}

export interface BotMessage {
  _id: string;
  botId: string;
  telegramId: number;
  senderName: string;
  direction: 'inbound' | 'outbound';
  text: string;
  updateId?: number;
  messageId?: number;
  status: 'received' | 'sent' | 'failed';
  timestamp: string;
  replyMarkup?: any;
  payload?: any;
}

export interface BotBroadcast {
  _id: string;
  botId: string;
  title: string;
  messageText: string;
  targetTags: string[];
  status: 'draft' | 'sending' | 'completed' | 'failed';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface BotLog {
  _id: string;
  botId: string;
  level: 'info' | 'warn' | 'error' | 'webhook';
  event: string;
  details: string;
  timestamp: string;
}

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface InlineBtn {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface BotCmdConfig {
  command: string;
  description: string;
  responseText: string;
  responseType: 'text' | 'inline_keyboard' | 'reply_keyboard' | 'ai';
  inlineKeyboard?: InlineBtn[][];
  replyKeyboard?: string[][];
  isActive: boolean;
}

export interface AutoReplyConfig {
  triggerType: 'exact' | 'contains' | 'regex';
  triggerValue: string;
  responseText: string;
  inlineKeyboard?: InlineBtn[][];
  isActive: boolean;
}

export interface IBotConfig extends Document {
  botId: Types.ObjectId | string;
  welcomeMessage: string;
  welcomeButtons?: InlineBtn[][];
  commandsList: BotCmdConfig[];
  autoReplies: AutoReplyConfig[];
  keyboardLayouts: Array<{
    name: string;
    type: 'inline' | 'reply';
    layout: any;
  }>;
  forceJoinChannelId?: string; // e.g., '@mychannel' or '-1001234567890'
  forceJoinChannelLink?: string; // e.g., 'https://t.me/mychannel'
  forceJoinAlertText?: string;
  defaultReplyText?: string;
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2';
  createdAt: Date;
  updatedAt: Date;
}

const InlineButtonSchema = new Schema(
  {
    text: { type: String, required: true },
    url: { type: String },
    callback_data: { type: String },
  },
  { _id: false }
);

const BotCommandSchema = new Schema(
  {
    command: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    responseText: { type: String, required: true },
    responseType: {
      type: String,
      enum: ['text', 'inline_keyboard', 'reply_keyboard', 'ai'],
      default: 'text',
    },
    inlineKeyboard: { type: [[InlineButtonSchema]], default: [] },
    replyKeyboard: { type: [[String]], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const AutoReplySchema = new Schema(
  {
    triggerType: {
      type: String,
      enum: ['exact', 'contains', 'regex'],
      default: 'contains',
    },
    triggerValue: { type: String, required: true },
    responseText: { type: String, required: true },
    inlineKeyboard: { type: [[InlineButtonSchema]], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const BotConfigSchema: Schema = new Schema(
  {
    botId: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
      unique: true,
      index: true,
    },
    welcomeMessage: {
      type: String,
      default: '👋 <b>Welcome!</b>\n\nI am your automated assistant. How can I help you today?',
    },
    welcomeButtons: {
      type: [[InlineButtonSchema]],
      default: [
        [
          { text: '🚀 Get Started', callback_data: 'cmd_start' },
          { text: 'ℹ️ Help Menu', callback_data: 'cmd_help' },
        ],
      ],
    },
    commandsList: {
      type: [BotCommandSchema],
      default: [],
    },
    autoReplies: {
      type: [AutoReplySchema],
      default: [],
    },
    keyboardLayouts: {
      type: [
        {
          name: { type: String, required: true },
          type: { type: String, enum: ['inline', 'reply'], default: 'inline' },
          layout: { type: Schema.Types.Mixed },
        },
      ],
      default: [],
    },
    forceJoinChannelId: {
      type: String,
      trim: true,
      default: '',
    },
    forceJoinChannelLink: {
      type: String,
      trim: true,
      default: '',
    },
    forceJoinAlertText: {
      type: String,
      default: '⚠️ <b>Access Denied: Channel Membership Required</b>\n\nPlease join our official channel to use this bot.',
    },
    defaultReplyText: {
      type: String,
      default: 'Thank you for reaching out! Type /help to see all available commands.',
    },
    parseMode: {
      type: String,
      enum: ['HTML', 'Markdown', 'MarkdownV2'],
      default: 'HTML',
    },
  },
  {
    timestamps: true,
  }
);

export const BotConfig =
  mongoose.models.BotConfig || mongoose.model<IBotConfig>('BotConfig', BotConfigSchema);

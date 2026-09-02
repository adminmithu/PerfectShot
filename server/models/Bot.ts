import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBot extends Document {
  userId: Types.ObjectId | string;
  botToken: string;
  botUsername: string;
  botName?: string;
  isActive: boolean;
  settings: {
    webhookUrl?: string;
    webhookStatus?: 'connected' | 'disconnected' | 'error' | 'pending';
    mode: 'webhook' | 'polling' | 'simulator';
    dropPendingUpdates?: boolean;
    allowedUpdates?: string[];
    maxConnections?: number;
    secretToken?: string;
    aiFallback?: boolean;
    aiSystemPrompt?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BotSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    botToken: {
      type: String,
      required: [true, 'Bot token is required'],
      trim: true,
      index: true,
    },
    botUsername: {
      type: String,
      required: [true, 'Bot username is required'],
      trim: true,
    },
    botName: {
      type: String,
      default: 'Telegram Bot',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      webhookUrl: {
        type: String,
        default: '',
      },
      webhookStatus: {
        type: String,
        enum: ['connected', 'disconnected', 'error', 'pending'],
        default: 'pending',
      },
      mode: {
        type: String,
        enum: ['webhook', 'polling', 'simulator'],
        default: 'webhook',
      },
      dropPendingUpdates: {
        type: Boolean,
        default: false,
      },
      allowedUpdates: {
        type: [String],
        default: ['message', 'callback_query'],
      },
      maxConnections: {
        type: Number,
        default: 40,
        min: 1,
        max: 100,
      },
      secretToken: {
        type: String,
        default: '',
      },
      aiFallback: {
        type: Boolean,
        default: true,
      },
      aiSystemPrompt: {
        type: String,
        default: 'You are a helpful customer support Telegram Bot.',
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Bot = mongoose.models.Bot || mongoose.model<IBot>('Bot', BotSchema);

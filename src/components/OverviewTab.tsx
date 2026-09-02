import React from 'react';
import {
  MessageSquare,
  Users,
  Terminal,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Globe,
  Radio,
  ExternalLink,
  Smartphone,
  Send,
  Plus
} from 'lucide-react';
import { TelegramBot, BotCommand, BotSubscriber, BotMessage, TabType } from '../types';

interface OverviewTabProps {
  bot: TelegramBot | null;
  commands: BotCommand[];
  subscribers: BotSubscriber[];
  messages: BotMessage[];
  onTabChange: (tab: TabType) => void;
  onOpenAddCommand: () => void;
  onOpenBroadcast: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  bot,
  commands,
  subscribers,
  messages,
  onTabChange,
  onOpenAddCommand,
  onOpenBroadcast,
}) => {
  if (!bot) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400">No bot selected. Please configure or select a bot above.</p>
      </div>
    );
  }

  // Calculate stats
  const totalMessages = (bot.stats?.messagesReceived || 0) + (bot.stats?.messagesSent || 0);
  const activeUsersCount = subscribers.length || bot.stats?.activeUsers || 0;
  const commandsRun = bot.stats?.commandsExecuted || 0;

  // Chart data points (simulated 7 days trend)
  const chartPoints = [
    { day: 'Mon', inbound: 42, outbound: 48 },
    { day: 'Tue', inbound: 68, outbound: 74 },
    { day: 'Wed', inbound: 55, outbound: 60 },
    { day: 'Thu', inbound: 89, outbound: 95 },
    { day: 'Fri', inbound: 112, outbound: 120 },
    { day: 'Sat', inbound: 78, outbound: 82 },
    { day: 'Sun', inbound: 94, outbound: 101 },
  ];

  const maxVal = Math.max(...chartPoints.map(p => p.outbound + p.inbound));

  return (
    <div className="space-y-6">
      {/* Bot Announcement / Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h1 className="text-xl font-bold text-white tracking-tight">{bot.name}</h1>
                <span className="text-xs bg-slate-800 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/30 font-mono">
                  @{bot.username}
                </span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>{bot.status.toUpperCase()}</span>
                </span>
                {bot.config.aiEnabled && (
                  <span className="text-[11px] bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30 font-medium">
                    ✨ Gemini AI Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{bot.description}</p>
            </div>
          </div>

          {/* Action shortcuts */}
          <div className="flex items-center space-x-2 shrink-0">
            <a
              href={`https://t.me/${bot.username}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition"
            >
              <span>Open in Telegram</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
            <button
              onClick={() => onTabChange('emulator')}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Launch Simulator</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Messages */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Updates & Messages</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{totalMessages.toLocaleString()}</span>
            <span className="text-[11px] font-medium text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +14.2%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
            <span>Inbound: {bot.stats?.messagesReceived || 0}</span>
            <span>Outbound: {bot.stats?.messagesSent || 0}</span>
          </div>
        </div>

        {/* Card 2: Active Subscribers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Subscriber Audience</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{activeUsersCount}</span>
            <span className="text-[11px] font-medium text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +8 new
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Registered subscribers in MongoDB database
          </div>
        </div>

        {/* Card 3: Commands Executed */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Commands Triggered</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Terminal className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{commandsRun.toLocaleString()}</span>
            <span className="text-[11px] text-slate-400">across {commands.length} rules</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Most used: <code className="text-amber-400/90">/start</code>, <code className="text-amber-400/90">/help</code>
          </div>
        </div>

        {/* Card 4: Webhook & Mode */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Gateway Pipeline</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-base font-bold text-white capitalize">{bot.mode} Mode</span>
            <span className="text-[11px] text-emerald-400 font-medium">Synced</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 truncate" title={bot.webhookUrl}>
            {bot.webhookUrl ? 'HTTPS Webhook Active' : 'Simulator Active'}
          </div>
        </div>
      </div>

      {/* Main Content Split: Activity Chart & Top Commands */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Activity Timeline */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Message Activity & Interaction Volume</h2>
              <p className="text-xs text-slate-400">Real-time update traffic over past 7 days</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center space-x-1 text-sky-400">
                <span className="w-2.5 h-2.5 bg-sky-400 rounded-full" />
                <span>Inbound</span>
              </span>
              <span className="flex items-center space-x-1 text-emerald-400">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                <span>Bot Replies</span>
              </span>
            </div>
          </div>

          {/* Clean SVG Bar Chart */}
          <div className="h-56 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-slate-800">
            {chartPoints.map((item, idx) => {
              const inboundHeight = Math.max(12, Math.round((item.inbound / maxVal) * 160));
              const outboundHeight = Math.max(14, Math.round((item.outbound / maxVal) * 160));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition">
                    {item.inbound + item.outbound}
                  </div>
                  <div className="w-full flex items-end justify-center gap-1">
                    <div
                      style={{ height: `${inboundHeight}px` }}
                      className="w-3 sm:w-5 bg-sky-500/70 group-hover:bg-sky-400 rounded-t transition"
                      title={`Inbound: ${item.inbound}`}
                    />
                    <div
                      style={{ height: `${outboundHeight}px` }}
                      className="w-3 sm:w-5 bg-emerald-500/70 group-hover:bg-emerald-400 rounded-t transition"
                      title={`Outbound: ${item.outbound}`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-2">{item.day}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-400">
            <span>Average API Response Latency: <strong className="text-white">42ms</strong></span>
            <span>Delivery Success Rate: <strong className="text-emerald-400">99.8%</strong></span>
          </div>
        </div>

        {/* Right Col: Top Commands Performance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Top Commands</h2>
              <button
                onClick={() => onTabChange('commands')}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium"
              >
                View all ({commands.length})
              </button>
            </div>

            <div className="space-y-3">
              {commands.slice(0, 5).map(cmd => (
                <div
                  key={cmd._id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="truncate mr-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-sky-400">/{cmd.command}</span>
                      <span className="text-[10px] text-slate-500 uppercase px-1 py-0.5 rounded bg-slate-800">
                        {cmd.responseType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{cmd.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-white">{cmd.usageCount || 0}</span>
                    <p className="text-[10px] text-slate-500">runs</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800/80">
            <button
              onClick={onOpenAddCommand}
              className="w-full flex items-center justify-center space-x-1.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Command</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Messages & Interaction Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Telegram Interactions</h2>
            <p className="text-xs text-slate-400">Live chat updates logged in database</p>
          </div>
          <button
            onClick={() => onTabChange('subscribers')}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium"
          >
            Open Audience Chat
          </button>
        </div>

        <div className="divide-y divide-slate-800">
          {messages.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No messages logged yet.</p>
          ) : (
            messages.slice(0, 5).map(msg => (
              <div key={msg._id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                      msg.direction === 'inbound'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {msg.direction === 'inbound' ? 'IN' : 'BOT'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-white">{msg.senderName}</span>
                      <span className="text-[10px] text-slate-500">ID: {msg.telegramId}</span>
                    </div>
                    <p
                      className="text-xs text-slate-300 mt-1 line-clamp-1"
                      dangerouslySetInnerHTML={{ __html: msg.text.replace(/<[^>]*>?/gm, ' ').slice(0, 120) }}
                    />
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 shrink-0">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

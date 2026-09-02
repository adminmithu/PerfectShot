import React, { useState } from 'react';
import { Radio, Send, Users, CheckCircle2, Clock, Plus, Tag, Eye } from 'lucide-react';
import { TelegramBot, BotBroadcast, BotSubscriber } from '../types';

interface BroadcastsTabProps {
  bot: TelegramBot | null;
  broadcasts: BotBroadcast[];
  subscribers: BotSubscriber[];
  onRefreshData: () => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const BroadcastsTab: React.FC<BroadcastsTabProps> = ({
  bot,
  broadcasts,
  subscribers,
  onRefreshData,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  const [title, setTitle] = useState('');
  const [messageText, setMessageText] = useState('');
  const [targetTag, setTargetTag] = useState<string>('all');
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!bot) {
    return <div className="p-8 text-center text-slate-400">Please select a bot.</div>;
  }

  // Get unique tags
  const tags = Array.from(new Set(subscribers.flatMap(s => s.tags || [])));

  // Estimated recipient count
  const estimatedCount =
    targetTag === 'all'
      ? subscribers.filter(s => !s.isBlocked).length
      : subscribers.filter(s => !s.isBlocked && s.tags?.includes(targetTag)).length;

  const handleLaunchBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !messageText.trim()) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/bots/${bot._id}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          messageText: messageText.trim(),
          targetTags: targetTag === 'all' ? ['all'] : [targetTag],
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Broadcast "${title}" delivered to ${data.data.sentCount} subscribers!`);
        setTitle('');
        setMessageText('');
        setIsCreateModalOpen(false);
        onRefreshData();
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        alert(data.error || 'Failed to dispatch broadcast');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Broadcast Campaigns</h2>
          <p className="text-xs text-slate-400">
            Dispatch announcements, updates, and promotions to targeted segments of your bot audience.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Broadcast</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Broadcast History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Campaign History ({broadcasts.length})</h3>
          <span className="text-xs text-slate-400">Past notifications delivered</span>
        </div>

        {broadcasts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No broadcast campaigns launched yet. Click "New Broadcast" to send your first message.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Campaign Name</th>
                  <th className="p-3.5">Target Audience</th>
                  <th className="p-3.5">Recipients</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Date Dispatched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {broadcasts.map(b => (
                  <tr key={b._id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <p className="font-semibold text-white">{b.title}</p>
                      <p
                        className="text-[11px] text-slate-400 mt-0.5 line-clamp-1"
                        dangerouslySetInnerHTML={{ __html: b.messageText.replace(/<[^>]*>?/gm, ' ') }}
                      />
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-400 text-[11px] font-medium border border-slate-700">
                        {b.targetTags.join(', ')}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-emerald-400">{b.sentCount}</span>
                        <span className="text-slate-500">/ {b.totalRecipients} sent</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">
                      {new Date(b.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Broadcast Modal / Composer */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create Broadcast Announcement</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLaunchBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Campaign Title (Internal Reference) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekend Flash Promo or Maintenance Notice"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Audience Segment
                </label>
                <div className="flex items-center space-x-2">
                  <select
                    value={targetTag}
                    onChange={e => setTargetTag(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="all">All Active Subscribers ({subscribers.length})</option>
                    {tags.map(t => (
                      <option key={t} value={t}>
                        Subscribers tagged #{t}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400 px-2">
                    Est: <strong className="text-white">{estimatedCount}</strong> users
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Broadcast Message (HTML Supported: <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;a href="..."&gt;</code>)
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Type your broadcast message to subscribers..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              {/* Message Live Bubble Preview */}
              {messageText && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                    Telegram Client Preview
                  </span>
                  <div className="bg-sky-600 text-white text-xs p-3 rounded-2xl rounded-br-none max-w-sm ml-auto shadow-md">
                    <div className="text-[10px] opacity-70 mb-0.5">{bot.name} (Broadcast)</div>
                    <div
                      className="space-y-1"
                      dangerouslySetInnerHTML={{ __html: messageText }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Sending Broadcast...' : `Dispatch to ${estimatedCount} Users`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

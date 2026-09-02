import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Tag,
  Shield,
  Send,
  MessageSquare,
  Clock,
  Check,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { TelegramBot, BotSubscriber, BotMessage } from '../types';

interface SubscribersTabProps {
  bot: TelegramBot | null;
  subscribers: BotSubscriber[];
  onRefreshData: () => void;
}

export const SubscribersTab: React.FC<SubscribersTabProps> = ({
  bot,
  subscribers,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [activeSubscriber, setActiveSubscriber] = useState<BotSubscriber | null>(null);
  const [chatMessages, setChatMessages] = useState<BotMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Collect unique tags
  const allTags = Array.from(new Set(subscribers.flatMap(s => s.tags || [])));

  // Filter subscribers
  const filteredSubscribers = subscribers.filter(s => {
    const nameMatch = `${s.firstName} ${s.lastName || ''} ${s.username || ''} ${s.telegramId}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const tagMatch = selectedTag === 'all' || (s.tags && s.tags.includes(selectedTag));
    return nameMatch && tagMatch;
  });

  // Select first subscriber by default if none selected
  useEffect(() => {
    if (!activeSubscriber && filteredSubscribers.length > 0) {
      setActiveSubscriber(filteredSubscribers[0]);
    }
  }, [filteredSubscribers, activeSubscriber]);

  // Load chat messages when active subscriber changes
  useEffect(() => {
    if (!bot || !activeSubscriber) return;

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/bots/${bot._id}/subscribers/${activeSubscriber.telegramId}/messages`);
        const data = await res.json();
        if (data.success) {
          setChatMessages(data.data);
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    };

    loadMessages();
  }, [bot, activeSubscriber]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bot || !activeSubscriber || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const res = await fetch(`/api/bots/${bot._id}/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: activeSubscriber.telegramId,
          text: replyText.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setChatMessages(prev => [...prev, data.data]);
        setReplyText('');
        onRefreshData();
      } else {
        alert(data.error || 'Failed to send message');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleAddTag = async () => {
    if (!activeSubscriber || !newTagInput.trim()) return;
    const tag = newTagInput.trim().toLowerCase();
    if (activeSubscriber.tags.includes(tag)) return;

    const updatedTags = [...activeSubscriber.tags, tag];
    try {
      await fetch(`/api/subscribers/${activeSubscriber._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      });
      setActiveSubscriber({ ...activeSubscriber, tags: updatedTags });
      setNewTagInput('');
      onRefreshData();
    } catch (e) {
      console.error('Failed to add tag:', e);
    }
  };

  const handleToggleBlock = async () => {
    if (!activeSubscriber) return;
    const nextBlocked = !activeSubscriber.isBlocked;
    try {
      await fetch(`/api/subscribers/${activeSubscriber._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: nextBlocked }),
      });
      setActiveSubscriber({ ...activeSubscriber, isBlocked: nextBlocked });
      onRefreshData();
    } catch (e) {
      console.error('Toggle block error:', e);
    }
  };

  const handleToggleHandover = async () => {
    if (!activeSubscriber) return;
    const nextHandover = !activeSubscriber.isHandoverActive;
    try {
      await fetch(`/api/subscribers/${activeSubscriber._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isHandoverActive: nextHandover,
          handoverReason: nextHandover ? 'Manually enabled by admin' : undefined,
        }),
      });
      setActiveSubscriber({ ...activeSubscriber, isHandoverActive: nextHandover });
      onRefreshData();
    } catch (e) {
      console.error('Toggle handover error:', e);
    }
  };

  if (!bot) {
    return <div className="p-8 text-center text-slate-400">Please select a bot.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Subscriber Audience CRM</h2>
          <p className="text-xs text-slate-400">
            Monitor registered Telegram users, manage tags, conduct direct 2-way chats, and toggle Live Agent takeover.
          </p>
        </div>
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <a
            href={`/api/bots/${bot._id}/export-subscribers`}
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
          >
            <span>📥 Export Leads (CSV)</span>
          </a>
          <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            Total Subscribers: <strong className="text-white">{subscribers.length}</strong>
          </span>
        </div>
      </div>

      {/* CRM Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
        {/* Left Column: Audience List (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {/* Search & Tag Filter Bar */}
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, @username, or ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Tag Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition ${
                  selectedTag === 'all'
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-white bg-slate-800/60'
                }`}
              >
                All ({subscribers.length})
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition ${
                    selectedTag === tag
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Subscribers Directory */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
            {filteredSubscribers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No subscribers found matching filter.</div>
            ) : (
              filteredSubscribers.map(sub => {
                const isSelected = activeSubscriber?._id === sub._id;
                return (
                  <button
                    key={sub._id}
                    onClick={() => setActiveSubscriber(sub)}
                    className={`w-full text-left p-3.5 hover:bg-slate-800/50 transition flex items-start justify-between ${
                      isSelected ? 'bg-slate-800/80 border-l-2 border-sky-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3 truncate">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0 font-bold text-sky-400">
                        {sub.firstName[0]}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center space-x-2">
                          <p className="text-xs font-semibold text-white truncate">{sub.firstName} {sub.lastName || ''}</p>
                          {sub.isHandoverActive && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              🧑‍💻 Live Agent
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">@{sub.username || 'user'}</p>
                        {sub.bookedSlot && (
                          <p className="text-[10px] text-emerald-400 mt-0.5">📅 Booked: {sub.bookedSlot}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <span className="text-[10px] text-slate-500">
                        {new Date(sub.lastSeenAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">{sub.interactionCount || 1} msgs</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat History & Direct Reply (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {activeSubscriber ? (
            <>
              {/* Subscriber Details Top Bar */}
              <div className="p-4 border-b border-slate-800 bg-slate-850 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-base font-bold text-sky-400">
                    {activeSubscriber.firstName[0]}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-white">
                        {activeSubscriber.firstName} {activeSubscriber.lastName || ''}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        ID: {activeSubscriber.telegramId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      @{activeSubscriber.username || 'unknown'} • Joined:{' '}
                      {new Date(activeSubscriber.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleToggleHandover}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      activeSubscriber.isHandoverActive
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                    title="Toggle Live Human Agent Takeover Mode"
                  >
                    {activeSubscriber.isHandoverActive ? '🧑‍💻 Live Agent Active (Click to Release)' : '🎧 Request Live Handover'}
                  </button>
                  <button
                    onClick={handleToggleBlock}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                      activeSubscriber.isBlocked
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {activeSubscriber.isBlocked ? 'Unblock User' : 'Block User'}
                  </button>
                </div>
              </div>

              {/* Tag Editor Bar */}
              <div className="px-4 py-2 border-b border-slate-800 bg-slate-850/50 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 mr-1 flex items-center space-x-1">
                  <Tag className="w-3 h-3" />
                  <span>Tags:</span>
                </span>
                {activeSubscriber.tags?.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-slate-800 text-sky-400 text-[11px] font-medium border border-slate-750"
                  >
                    #{tag}
                  </span>
                ))}
                <div className="flex items-center space-x-1 ml-1">
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={handleAddTag}
                    className="p-0.5 text-slate-400 hover:text-white"
                    title="Add Tag"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Live Chat Messages Scroll Container */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                    <MessageSquare className="w-8 h-8 text-slate-700 mb-2" />
                    <p>No messages recorded with this user yet.</p>
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isInbound = msg.direction === 'inbound';
                    return (
                      <div
                        key={msg._id}
                        className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-md rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                            isInbound
                              ? 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60'
                              : 'bg-sky-600 text-white rounded-br-none'
                          }`}
                        >
                          <div className="text-[10px] font-semibold opacity-70 mb-0.5">
                            {msg.senderName}
                          </div>
                          <div
                            className="space-y-1"
                            dangerouslySetInnerHTML={{ __html: msg.text }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Direct Outbound Message Composer */}
              <form onSubmit={handleSendReply} className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2">
                <input
                  type="text"
                  placeholder={`Send direct message as ${bot.name} (HTML supported)...`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={isSendingReply || !replyText.trim()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingReply ? 'Sending...' : 'Send'}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500 text-xs">
              Select a subscriber to view their profile and live chat messages.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

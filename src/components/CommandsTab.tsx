import React, { useState } from 'react';
import {
  Terminal,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Send,
  Zap,
  Globe,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { BotCommand, AutoResponder, TelegramBot, InlineKeyboardButton } from '../types';

interface CommandsTabProps {
  bot: TelegramBot | null;
  commands: BotCommand[];
  responders: AutoResponder[];
  onRefreshData: () => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}

export const CommandsTab: React.FC<CommandsTabProps> = ({
  bot,
  commands,
  responders,
  onRefreshData,
  isAddModalOpen,
  setIsAddModalOpen,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'commands' | 'responders'>('commands');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Command form state
  const [editingCommand, setEditingCommand] = useState<BotCommand | null>(null);
  const [cmdName, setCmdName] = useState('');
  const [cmdDesc, setCmdDesc] = useState('');
  const [cmdType, setCmdType] = useState<'text' | 'inline_keyboard' | 'reply_keyboard'>('text');
  const [cmdResponse, setCmdResponse] = useState('');
  const [inlineButtons, setInlineButtons] = useState<InlineKeyboardButton[]>([
    { text: '🔗 Learn More', url: 'https://telegram.org' },
  ]);

  // Auto-responder form state
  const [isAddResponderOpen, setIsAddResponderOpen] = useState(false);
  const [respTriggerType, setRespTriggerType] = useState<'exact' | 'contains' | 'regex'>('contains');
  const [respTriggerVal, setRespTriggerVal] = useState('');
  const [respText, setRespText] = useState('');

  if (!bot) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please select a bot to configure commands and auto-responders.
      </div>
    );
  }

  const handleSyncTelegramCommands = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/bots/${bot._id}/sync-commands`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncStatus('Successfully pushed commands to Telegram via setMyCommands!');
        setTimeout(() => setSyncStatus(null), 4000);
      } else {
        setSyncStatus('Failed to sync: ' + (data.error || 'Check bot token'));
      }
    } catch (e: any) {
      setSyncStatus('Sync error: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdName || !cmdResponse) return;

    try {
      const payload = {
        command: cmdName.replace(/^\//, '').trim(),
        description: cmdDesc,
        responseType: cmdType,
        responseText: cmdResponse,
        inlineKeyboard: cmdType === 'inline_keyboard' ? [inlineButtons] : undefined,
      };

      if (editingCommand) {
        await fetch(`/api/commands/${editingCommand._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/bots/${bot._id}/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setEditingCommand(null);
      setCmdName('');
      setCmdDesc('');
      setCmdResponse('');
      setIsAddModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteCommand = async (cmdId: string) => {
    if (!confirm('Are you sure you want to delete this command?')) return;
    try {
      await fetch(`/api/commands/${cmdId}`, { method: 'DELETE' });
      onRefreshData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveResponder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respTriggerVal || !respText) return;

    try {
      await fetch(`/api/bots/${bot._id}/responders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerType: respTriggerType,
          triggerValue: respTriggerVal,
          responseText: respText,
        }),
      });

      setRespTriggerVal('');
      setRespText('');
      setIsAddResponderOpen(false);
      onRefreshData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteResponder = async (id: string) => {
    try {
      await fetch(`/api/responders/${id}`, { method: 'DELETE' });
      onRefreshData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with Subtabs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('commands')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'commands'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Slash Commands ({commands.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('responders')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'responders'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Auto-Responders ({responders.length})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {activeSubTab === 'commands' && (
            <button
              onClick={handleSyncTelegramCommands}
              disabled={isSyncing}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition"
              title="Upload commands to Telegram via setMyCommands"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
              <span>Sync to Telegram</span>
            </button>
          )}

          <button
            onClick={() => {
              if (activeSubTab === 'commands') {
                setEditingCommand(null);
                setCmdName('');
                setCmdDesc('');
                setCmdResponse('');
                setIsAddModalOpen(true);
              } else {
                setIsAddResponderOpen(true);
              }
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{activeSubTab === 'commands' ? 'New Command' : 'New Auto-Rule'}</span>
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* ================= COMMANDS SUBTAB ================= */}
      {activeSubTab === 'commands' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {commands.map(cmd => (
            <div
              key={cmd._id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                      /{cmd.command}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {cmd.responseType}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        setEditingCommand(cmd);
                        setCmdName(cmd.command);
                        setCmdDesc(cmd.description);
                        setCmdType(cmd.responseType as any);
                        setCmdResponse(cmd.responseText);
                        if (cmd.inlineKeyboard?.[0]) {
                          setInlineButtons(cmd.inlineKeyboard[0]);
                        }
                        setIsAddModalOpen(true);
                      }}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCommand(cmd._id)}
                      className="p-1 hover:bg-rose-500/20 rounded text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2">{cmd.description}</p>

                {/* Telegram Message Preview Bubble */}
                <div className="mt-3 p-3 rounded-xl bg-slate-800/90 border border-slate-750 text-xs text-slate-200">
                  <div
                    className="space-y-1"
                    dangerouslySetInnerHTML={{ __html: cmd.responseText }}
                  />

                  {/* Inline Buttons Preview */}
                  {cmd.responseType === 'inline_keyboard' && cmd.inlineKeyboard && (
                    <div className="mt-3 pt-2 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                      {cmd.inlineKeyboard.flat().map((btn, idx) => (
                        <div
                          key={idx}
                          className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-650 text-sky-300 text-[11px] font-medium border border-slate-600/60"
                        >
                          {btn.text} {btn.url && '↗'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 mt-3 border-t border-slate-800">
                <span>Usage: <strong>{cmd.usageCount || 0} executions</strong></span>
                <span className="text-emerald-400 font-medium">Active</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= AUTO-RESPONDERS SUBTAB ================= */}
      {activeSubTab === 'responders' && (
        <div className="space-y-3">
          {responders.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
              No auto-responders configured yet. Add keyword rules to reply to phrases like "refund", "human agent", or "pricing".
            </div>
          ) : (
            responders.map(r => (
              <div
                key={r._id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {r.triggerType}
                    </span>
                    <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                      "{r.triggerValue}"
                    </span>
                    <span className="text-[11px] text-slate-400">Trigger count: {r.hitCount || 0}</span>
                  </div>
                  <p
                    className="text-xs text-slate-300 mt-2 line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: r.responseText }}
                  />
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleDeleteResponder(r._id)}
                    className="p-1.5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add / Edit Command Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingCommand ? 'Edit Command' : 'Create Bot Command'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCommand} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Command (without /) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-mono text-slate-500">/</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. faq"
                      value={cmdName}
                      onChange={e => setCmdName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-6 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Response Type</label>
                  <select
                    value={cmdType}
                    onChange={e => setCmdType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="text">Formatted Text (HTML)</option>
                    <option value="inline_keyboard">Inline Keyboard (Buttons)</option>
                    <option value="reply_keyboard">Reply Keyboard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Menu Description (shows in Telegram slash popup)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Frequently asked questions and guide"
                  value={cmdDesc}
                  onChange={e => setCmdDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Response Text (Supports <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;code&gt;</code>)
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter message text with HTML tags..."
                  value={cmdResponse}
                  onChange={e => setCmdResponse(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              {/* Inline Buttons Builder */}
              {cmdType === 'inline_keyboard' && (
                <div className="p-3 bg-slate-800/70 border border-slate-750 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Inline Action Buttons</span>
                    <button
                      type="button"
                      onClick={() =>
                        setInlineButtons([
                          ...inlineButtons,
                          { text: 'New Button', callback_data: 'cmd_action' },
                        ])
                      }
                      className="text-[11px] text-sky-400 hover:text-sky-300 font-medium"
                    >
                      + Add Button
                    </button>
                  </div>

                  {inlineButtons.map((btn, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Button Label"
                        value={btn.text}
                        onChange={e => {
                          const copy = [...inlineButtons];
                          copy[idx].text = e.target.value;
                          setInlineButtons(copy);
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="URL (https://) or callback_data"
                        value={btn.url || btn.callback_data || ''}
                        onChange={e => {
                          const copy = [...inlineButtons];
                          const val = e.target.value;
                          if (val.startsWith('http')) {
                            copy[idx].url = val;
                            delete copy[idx].callback_data;
                          } else {
                            copy[idx].callback_data = val;
                            delete copy[idx].url;
                          }
                          setInlineButtons(copy);
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                      {inlineButtons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setInlineButtons(inlineButtons.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition"
                >
                  Save Command
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Auto-responder Modal */}
      {isAddResponderOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create Auto-Responder Rule</h3>
              <button
                onClick={() => setIsAddResponderOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveResponder} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Trigger Type</label>
                  <select
                    value={respTriggerType}
                    onChange={e => setRespTriggerType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="contains">Contains Keyword</option>
                    <option value="exact">Exact Phrase</option>
                    <option value="regex">Regular Expression</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Trigger Value <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. refund, human, price"
                    value={respTriggerVal}
                    onChange={e => setRespTriggerVal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Automatic Reply Message
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="The bot will reply with this message when the trigger is matched..."
                  value={respText}
                  onChange={e => setRespText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddResponderOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition"
                >
                  Save Auto-Responder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

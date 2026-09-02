import React, { useState } from 'react';
import {
  Bot,
  Plus,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  Sparkles,
  Settings,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { TelegramBot } from '../types';

interface BotsTabProps {
  bots: TelegramBot[];
  selectedBot: TelegramBot | null;
  onSelectBot: (bot: TelegramBot) => void;
  onBotUpdated: () => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}

export const BotsTab: React.FC<BotsTabProps> = ({
  bots,
  selectedBot,
  onSelectBot,
  onBotUpdated,
  isAddModalOpen,
  setIsAddModalOpen,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [revealedTokens, setRevealedTokens] = useState<Record<string, boolean>>({});

  // AI Generator state
  const [aiIndustry, setAiIndustry] = useState('');
  const [aiTone, setAiTone] = useState('friendly, knowledgeable and professional');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Settings drawer state
  const [editingBot, setEditingBot] = useState<TelegramBot | null>(null);
  const [aiPromptEdit, setAiPromptEdit] = useState('');
  const [defaultReplyEdit, setDefaultReplyEdit] = useState('');
  const [aiEnabledEdit, setAiEnabledEdit] = useState(true);
  const [knowledgeBaseEdit, setKnowledgeBaseEdit] = useState('');
  const [forceJoinEnabledEdit, setForceJoinEnabledEdit] = useState(false);
  const [forceJoinChannelEdit, setForceJoinChannelEdit] = useState('');
  const [forceJoinMsgEdit, setForceJoinMsgEdit] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const toggleTokenVisibility = (id: string) => {
    setRevealedTokens(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const handleTestToken = async () => {
    if (!tokenInput.trim()) return;
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const res = await fetch('/api/telegram/direct-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim(), method: 'getMe' }),
      });
      const data = await res.json();
      setVerifyResult(data.response);
      if (data.response?.ok && data.response.result?.first_name && !nameInput) {
        setNameInput(data.response.result.first_name);
      }
    } catch (e: any) {
      setVerifyResult({ ok: false, description: e.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput.trim(),
          name: nameInput.trim() || undefined,
          description: descInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTokenInput('');
        setNameInput('');
        setDescInput('');
        setVerifyResult(null);
        setIsAddModalOpen(false);
        onBotUpdated();
      } else {
        alert(data.error || 'Failed to create bot');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGenerateAiPersona = async () => {
    if (!aiIndustry.trim()) return;
    setIsGeneratingAi(true);

    try {
      const res = await fetch('/api/ai/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: aiIndustry, tone: aiTone }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setNameInput(data.data.name || '');
        setDescInput(data.data.description || '');
      }
    } catch (e) {
      console.error('AI template failed:', e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleDeleteBot = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the bot "${name}" and all associated data?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/bots/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        onBotUpdated();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openEditDrawer = (bot: TelegramBot) => {
    setEditingBot(bot);
    setAiPromptEdit(bot.config.aiPrompt || '');
    setDefaultReplyEdit(bot.config.defaultReply || '');
    setAiEnabledEdit(Boolean(bot.config.aiEnabled));
    setKnowledgeBaseEdit(bot.config.knowledgeBase || '');
    setForceJoinEnabledEdit(Boolean(bot.config.forceJoin?.enabled));
    setForceJoinChannelEdit(bot.config.forceJoin?.channelUsername || '');
    setForceJoinMsgEdit(bot.config.forceJoin?.customMessage || '');
  };

  const handleSaveSettings = async () => {
    if (!editingBot) return;
    setIsSavingSettings(true);

    try {
      const res = await fetch(`/api/bots/${editingBot._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            ...editingBot.config,
            aiEnabled: aiEnabledEdit,
            aiPrompt: aiPromptEdit,
            defaultReply: defaultReplyEdit,
            knowledgeBase: knowledgeBaseEdit,
            forceJoin: {
              enabled: forceJoinEnabledEdit,
              channelUsername: forceJoinChannelEdit.trim(),
              customMessage: forceJoinMsgEdit.trim(),
            },
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEditingBot(null);
        onBotUpdated();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Bot Fleet Management</h2>
          <p className="text-xs text-slate-400">
            Configure tokens, monitor Telegram verification status, and set conversational behaviors.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Telegram Bot</span>
        </button>
      </div>

      {/* Bots Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {bots.map(bot => {
          const isSelected = selectedBot?._id === bot._id;
          const isRevealed = revealedTokens[bot._id];

          return (
            <div
              key={bot._id}
              className={`bg-slate-900 border rounded-2xl p-6 transition flex flex-col justify-between ${
                isSelected ? 'border-sky-500 shadow-md shadow-sky-500/10' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Top Bot Meta */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                      🤖
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-white">{bot.name}</h3>
                        {bot.isVerified ? (
                          <span title="Verified via Telegram getMe">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          </span>
                        ) : (
                          <span title="Token verification pending">
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                          </span>
                        )}
                      </div>
                      <a
                        href={`https://t.me/${bot.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-400 hover:underline inline-flex items-center space-x-1"
                      >
                        <span>@{bot.username}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                      bot.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {bot.status.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-3">{bot.description}</p>

                {/* Token Section */}
                <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-750">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Telegram API Token</span>
                    <button
                      onClick={() => toggleTokenVisibility(bot._id)}
                      className="text-sky-400 hover:text-sky-300 flex items-center space-x-1"
                    >
                      {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-slate-300 truncate max-w-[280px]">
                      {isRevealed ? bot.token : bot.token.slice(0, 10) + '••••••••••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => copyToClipboard(bot.token, bot._id)}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                      title="Copy Token"
                    >
                      {copiedTokenId === bot._id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bot Stats summary */}
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Messages</span>
                    <span className="text-xs font-semibold text-white">
                      {(bot.stats?.messagesReceived || 0) + (bot.stats?.messagesSent || 0)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Commands</span>
                    <span className="text-xs font-semibold text-white">{bot.stats?.commandsExecuted || 0}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">AI Fallback</span>
                    <span className="text-xs font-semibold text-violet-400">
                      {bot.config.aiEnabled ? 'Enabled' : 'Off'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bot Actions */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onSelectBot(bot)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isSelected
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isSelected ? 'Currently Selected' : 'Set as Active'}
                  </button>
                  <button
                    onClick={() => openEditDrawer(bot)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
                    title="Configure AI & Defaults"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {bots.length > 1 && (
                  <button
                    onClick={() => handleDeleteBot(bot._id, bot.name)}
                    className="p-1.5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition"
                    title="Delete Bot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect / Add New Bot Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                  🤖
                </div>
                <h3 className="text-base font-bold text-white">Connect Telegram Bot</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Guide Info */}
            <div className="mt-4 p-3 bg-sky-950/30 border border-sky-800/40 rounded-xl text-xs text-sky-200">
              <p className="font-semibold mb-1">How to obtain a Bot Token:</p>
              <ol className="list-decimal list-inside space-y-1 text-sky-300/90">
                <li>
                  Open Telegram and search for <strong>@BotFather</strong>
                </li>
                <li>Send the command <code>/newbot</code> and follow prompts</li>
                <li>Copy the API token provided and paste it below. (Or test with demo token!)</li>
              </ol>
            </div>

            {/* AI Generator Option */}
            <div className="mt-4 p-3.5 bg-slate-800/50 border border-slate-750 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>AI Persona Generator</span>
                </span>
                <span className="text-[10px] text-violet-400 font-medium">Powered by Gemini</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Crypto trading alerts, Dental clinic support, Barber shop..."
                  value={aiIndustry}
                  onChange={e => setAiIndustry(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handleGenerateAiPersona}
                  disabled={isGeneratingAi || !aiIndustry.trim()}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1"
                >
                  {isGeneratingAi && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>Generate</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateBot} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telegram Bot API Token <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="123456789:ABCdefGHIjklmnOPQRstuvwXYZ"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestToken}
                    disabled={isVerifying || !tokenInput.trim()}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-sky-400 rounded-xl font-medium transition"
                  >
                    {isVerifying ? 'Testing...' : 'Verify'}
                  </button>
                </div>

                {verifyResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-xs flex items-start space-x-2 ${
                      verifyResult.ok
                        ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                        : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
                    }`}
                  >
                    {verifyResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    )}
                    <div>
                      {verifyResult.ok ? (
                        <p>
                          <strong>Verified!</strong> Telegram Bot Name: "{verifyResult.result?.first_name}" (@
                          {verifyResult.result?.username})
                        </p>
                      ) : (
                        <p>
                          <strong>Verification error:</strong> {verifyResult.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Customer Care"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description / Purpose</label>
                <textarea
                  rows={2}
                  placeholder="What will this bot do for your users?"
                  value={descInput}
                  onChange={e => setDescInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
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
                  Save & Initialize Bot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bot Settings / AI Drawer */}
      {editingBot && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">Bot AI & Behavior Settings</h3>
              </div>
              <button
                onClick={() => setEditingBot(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiEnabledEdit}
                    onChange={e => setAiEnabledEdit(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 bg-slate-800 border-slate-700"
                  />
                  <span className="text-xs font-semibold text-white">
                    Enable Autonomous Gemini AI Conversational Fallback
                  </span>
                </label>
                <p className="text-[11px] text-slate-400 mt-1 pl-6">
                  When a user sends a message that doesn't match any slash command or auto-responder rule, the bot
                  uses Gemini AI to answer intelligently.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  AI System Instructions & Persona
                </label>
                <textarea
                  rows={3}
                  value={aiPromptEdit}
                  onChange={e => setAiPromptEdit(e.target.value)}
                  placeholder="You are an automated support bot. Always be polite..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Knowledge Base Section */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-sky-400">
                  🧠 AI Knowledge Base / Business Facts
                </label>
                <p className="text-[11px] text-slate-400">
                  Paste your business FAQs, product specs, pricing, or refund policies. Gemini AI will use this context to answer customer questions accurately.
                </p>
                <textarea
                  rows={3}
                  value={knowledgeBaseEdit}
                  onChange={e => setKnowledgeBaseEdit(e.target.value)}
                  placeholder="e.g. Working hours: 9 AM - 6 PM. Standard shipping takes 2 days. Return policy: 7 days full refund..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Force Join Gateway Section */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceJoinEnabledEdit}
                    onChange={e => setForceJoinEnabledEdit(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 bg-slate-800 border-slate-700"
                  />
                  <span className="text-xs font-bold text-amber-400">
                    🔒 Mandatory Force Join Channel Gateway
                  </span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Require users to join your official Telegram Channel before they can unlock bot commands.
                </p>

                {forceJoinEnabledEdit && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Channel Username (e.g. @MyOfficialChannel)
                      </label>
                      <input
                        type="text"
                        placeholder="@MyOfficialChannel"
                        value={forceJoinChannelEdit}
                        onChange={e => setForceJoinChannelEdit(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Custom Restriction Message (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="⚠️ Please join @MyOfficialChannel to access this bot!"
                        value={forceJoinMsgEdit}
                        onChange={e => setForceJoinMsgEdit(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Static Default Reply (Used if AI is disabled)
                </label>
                <input
                  type="text"
                  value={defaultReplyEdit}
                  onChange={e => setDefaultReplyEdit(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingBot(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition"
              >
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  Check,
  Code,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Smile,
  Send,
  Save,
  Grid,
  Eye,
  Type,
  Link,
  ShieldAlert,
  Bot as BotIcon,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';
import { TelegramBot, InlineKeyboardButton } from '../types';

interface ButtonBuilderProps {
  bots: TelegramBot[];
  selectedBotId: string;
  onSelectBot: (id: string) => void;
  onSaveToCommand?: (cmd: {
    command: string;
    description: string;
    responseText: string;
    inlineKeyboard?: InlineKeyboardButton[][];
  }) => void;
}

const QUICK_EMOJIS = ['🚀', '✨', '💎', '🛒', '💳', '🎁', '⚡', 'ℹ️', '📞', '🌐', '📢', '🔒', '⭐', '🔥'];

export const ButtonBuilder: React.FC<ButtonBuilderProps> = ({
  bots,
  selectedBotId,
  onSelectBot,
  onSaveToCommand,
}) => {
  const selectedBot = bots.find(b => b._id === selectedBotId) || bots[0];

  // Message Formatter State
  const [messageText, setMessageText] = useState(
    '👋 <b>Welcome to Nexus Store!</b>\n\nPlease choose an option from the menu below or tap <b>Browse Catalog</b> to explore our premium plans.'
  );
  const [parseMode, setParseMode] = useState<'HTML' | 'Markdown' | 'MarkdownV2'>('HTML');

  // Keyboard Builder State
  const [keyboardType, setKeyboardType] = useState<'inline' | 'reply'>('inline');
  const [rows, setRows] = useState<
    Array<
      Array<{
        text: string;
        type: 'url' | 'callback_data' | 'web_app';
        value: string;
      }>
    >
  >([
    [
      { text: '🛍️ Browse Catalog', type: 'callback_data', value: 'browse_catalog' },
      { text: '💎 Upgrade to Pro', type: 'callback_data', value: 'buy_pro' },
    ],
    [
      { text: '🌐 Official Website', type: 'url', value: 'https://telegram.org' },
      { text: '💬 Live Support', type: 'callback_data', value: 'cmd_support' },
    ],
  ]);

  // Active editing button coordinates: [rowIndex, colIndex]
  const [editingCoord, setEditingCoord] = useState<[number, number] | null>([0, 0]);

  // Code Export Modal / Copy State
  const [activeTab, setActiveTab] = useState<'builder' | 'json' | 'telegraf'>('builder');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveCommandName, setSaveCommandName] = useState('menu');
  const [isSaving, setIsSaving] = useState(false);
  const [previewClickedData, setPreviewClickedData] = useState<string | null>(null);

  // Quick Preset Layouts
  const applyPresetLayout = (preset: '1x1' | '1x2' | '2x2' | '3x1' | '3x2') => {
    switch (preset) {
      case '1x1':
        setRows([[{ text: '🚀 Get Started', type: 'callback_data', value: 'cmd_start' }]]);
        setEditingCoord([0, 0]);
        break;
      case '1x2':
        setRows([
          [
            { text: '✅ Accept', type: 'callback_data', value: 'accept' },
            { text: '❌ Decline', type: 'callback_data', value: 'decline' },
          ],
        ]);
        setEditingCoord([0, 0]);
        break;
      case '2x2':
        setRows([
          [
            { text: '🛒 Shop Now', type: 'callback_data', value: 'shop' },
            { text: '💳 Pricing', type: 'callback_data', value: 'cmd_pricing' },
          ],
          [
            { text: 'ℹ️ About Us', type: 'callback_data', value: 'cmd_about' },
            { text: '📞 Contact', type: 'callback_data', value: 'cmd_contact' },
          ],
        ]);
        setEditingCoord([0, 0]);
        break;
      case '3x1':
        setRows([
          [{ text: '⭐ Option 1: Basic', type: 'callback_data', value: 'plan_basic' }],
          [{ text: '🚀 Option 2: Pro', type: 'callback_data', value: 'plan_pro' }],
          [{ text: '💎 Option 3: Enterprise', type: 'callback_data', value: 'plan_enterprise' }],
        ]);
        setEditingCoord([0, 0]);
        break;
      case '3x2':
        setRows([
          [
            { text: '⚡ Features', type: 'callback_data', value: 'features' },
            { text: '📊 Dashboard', type: 'callback_data', value: 'dashboard' },
          ],
          [
            { text: '📢 Channel', type: 'url', value: 'https://t.me/telegram' },
            { text: '👥 Community', type: 'url', value: 'https://t.me/durov' },
          ],
          [
            { text: '⚙️ Settings', type: 'callback_data', value: 'settings' },
            { text: '❓ Help', type: 'callback_data', value: 'cmd_help' },
          ],
        ]);
        setEditingCoord([0, 0]);
        break;
    }
  };

  // Insert Rich Text Formatting tags
  const insertFormatting = (tagOpen: string, tagClose: string) => {
    setMessageText(prev => `${prev} ${tagOpen}text${tagClose}`);
  };

  // Insert Emoji into Message or currently edited button
  const insertEmoji = (emoji: string) => {
    if (editingCoord) {
      const [r, c] = editingCoord;
      const copy = [...rows];
      if (copy[r] && copy[r][c]) {
        copy[r][c].text = `${emoji} ${copy[r][c].text.replace(/^[\p{Emoji}\s]+/u, '')}`.trim();
        setRows(copy);
        return;
      }
    }
    setMessageText(prev => `${prev} ${emoji}`);
  };

  // Button Manipulation
  const handleAddRow = () => {
    setRows(prev => [...prev, [{ text: '✨ New Button', type: 'callback_data', value: 'btn_action' }]]);
    setEditingCoord([rows.length, 0]);
  };

  const handleAddButtonToRow = (rowIndex: number) => {
    setRows(prev => {
      const copy = [...prev];
      if (copy[rowIndex].length < 8) {
        copy[rowIndex].push({
          text: `Button ${copy[rowIndex].length + 1}`,
          type: 'callback_data',
          value: `btn_${Date.now()}`,
        });
      }
      return copy;
    });
  };

  const handleRemoveButton = (rowIndex: number, colIndex: number) => {
    setRows(prev => {
      const copy = [...prev];
      copy[rowIndex].splice(colIndex, 1);
      if (copy[rowIndex].length === 0) {
        copy.splice(rowIndex, 1);
      }
      return copy;
    });
    setEditingCoord(null);
  };

  const handleRemoveRow = (rowIndex: number) => {
    setRows(prev => prev.filter((_, i) => i !== rowIndex));
    setEditingCoord(null);
  };

  const updateCurrentButton = (field: 'text' | 'type' | 'value', val: string) => {
    if (!editingCoord) return;
    const [r, c] = editingCoord;
    setRows(prev => {
      const copy = [...prev];
      if (copy[r] && copy[r][c]) {
        copy[r][c] = { ...copy[r][c], [field]: val };
      }
      return copy;
    });
  };

  // Generate Telegram API payload
  const generatePayload = () => {
    if (keyboardType === 'inline') {
      const inlineKeyboard = rows.map(row =>
        row.map(btn => {
          if (btn.type === 'url') {
            return { text: btn.text, url: btn.value };
          } else if (btn.type === 'web_app') {
            return { text: btn.text, web_app: { url: btn.value } };
          }
          return { text: btn.text, callback_data: btn.value };
        })
      );

      return {
        text: messageText,
        parse_mode: parseMode,
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      };
    } else {
      const replyKeyboard = rows.map(row => row.map(btn => ({ text: btn.text })));
      return {
        text: messageText,
        parse_mode: parseMode,
        reply_markup: {
          keyboard: replyKeyboard,
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      };
    }
  };

  // Generate Telegraf.js code
  const generateTelegrafCode = () => {
    const payload = generatePayload();
    if (keyboardType === 'inline') {
      return `// Telegraf.js / Node-telegram-bot-api handler
bot.command('${saveCommandName}', async (ctx) => {
  await ctx.replyWithHTML(
    \`${messageText.replace(/`/g, '\\`')}\`,
    Markup.inlineKeyboard([
${rows
  .map(
    row =>
      '      [' +
      row
        .map(b =>
          b.type === 'url'
            ? `Markup.button.url('${b.text}', '${b.value}')`
            : `Markup.button.callback('${b.text}', '${b.value}')`
        )
        .join(', ') +
      ']'
  )
  .join(',\n')}
    ])
  );
});`;
    } else {
      return `// Reply Keyboard handler
bot.command('${saveCommandName}', async (ctx) => {
  await ctx.replyWithHTML(
    \`${messageText.replace(/`/g, '\\`')}\`,
    Markup.keyboard([
${rows.map(row => '      [' + row.map(b => `'${b.text}'`).join(', ') + ']').join(',\n')}
    ]).resize()
  );
});`;
    }
  };

  // Copy code
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save to bot commands in database
  const handleSaveToBot = async () => {
    if (!selectedBot) return;
    setIsSaving(true);
    try {
      const inlineKeyboard = rows.map(row =>
        row.map(btn => ({
          text: btn.text,
          url: btn.type === 'url' ? btn.value : undefined,
          callback_data: btn.type === 'callback_data' ? btn.value : undefined,
        }))
      );

      const res = await fetch(`/api/bots/${selectedBot._id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: saveCommandName,
          description: `Visual builder menu for /${saveCommandName}`,
          responseType: keyboardType === 'inline' ? 'inline_keyboard' : 'reply_keyboard',
          responseText: messageText,
          inlineKeyboard: keyboardType === 'inline' ? inlineKeyboard : undefined,
          replyKeyboard: keyboardType === 'reply' ? rows.map(r => r.map(b => b.text)) : undefined,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        if (onSaveToCommand) {
          onSaveToCommand({
            command: saveCommandName,
            description: `Visual builder menu`,
            responseText: messageText,
            inlineKeyboard,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Preview click handler
  const handlePreviewButtonClick = (btn: { text: string; type: string; value: string }) => {
    if (btn.type === 'url') {
      window.open(btn.value, '_blank');
    } else {
      setPreviewClickedData(`Triggered callback_data: "${btn.value}"`);
      setTimeout(() => setPreviewClickedData(null), 3000);
    }
  };

  const currentEditingButton =
    editingCoord && rows[editingCoord[0]] && rows[editingCoord[0]][editingCoord[1]]
      ? rows[editingCoord[0]][editingCoord[1]]
      : null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Visual Button & Message Builder
            </h2>
            <p className="text-xs text-slate-400">
              Compose formatted Telegram messages with interactive Inline or Reply keyboards, grid layouts, and live device preview.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedBotId}
            onChange={e => onSelectBot(e.target.value)}
            className="bg-slate-950 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-500 font-medium"
          >
            {bots.map(b => (
              <option key={b._id} value={b._id}>
                🤖 {b.name} (@{b.username})
              </option>
            ))}
          </select>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('builder')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                activeTab === 'builder' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Visual Editor
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                activeTab === 'json' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              JSON Payload
            </button>
            <button
              onClick={() => setActiveTab('telegraf')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                activeTab === 'telegraf' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Node/Telegraf
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'builder' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Message Editor & Keyboard Layout Builder (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Message Text & Formatting Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Message Formatter</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Parse Mode:</span>
                  <select
                    value={parseMode}
                    onChange={e => setParseMode(e.target.value as any)}
                    className="bg-slate-950 text-slate-300 text-xs px-2 py-1 rounded border border-slate-700"
                  >
                    <option value="HTML">HTML (Recommended)</option>
                    <option value="Markdown">Markdown</option>
                    <option value="MarkdownV2">MarkdownV2</option>
                  </select>
                </div>
              </div>

              {/* Rich Text Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
                <button
                  onClick={() => insertFormatting('<b>', '</b>')}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 font-bold text-xs"
                  title="Bold (<b>text</b>)"
                >
                  B
                </button>
                <button
                  onClick={() => insertFormatting('<i>', '</i>')}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 italic text-xs"
                  title="Italic (<i>text</i>)"
                >
                  I
                </button>
                <button
                  onClick={() => insertFormatting('<u>', '</u>')}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 underline text-xs"
                  title="Underline (<u>text</u>)"
                >
                  U
                </button>
                <button
                  onClick={() => insertFormatting('<s>', '</s>')}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 line-through text-xs"
                  title="Strikethrough (<s>text</s>)"
                >
                  S
                </button>
                <button
                  onClick={() => insertFormatting('<code>', '</code>')}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 font-mono text-xs text-cyan-300"
                  title="Monospace (<code>code</code>)"
                >
                  &lt;code&gt;
                </button>
                <button
                  onClick={() => insertFormatting('<tg-spoiler>', '</tg-spoiler>')}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-xs text-amber-300"
                  title="Spoiler (<tg-spoiler>secret</tg-spoiler>)"
                >
                  Spoiler
                </button>
                <button
                  onClick={() => insertFormatting('<a href="https://telegram.org">', '</a>')}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-xs text-blue-400 flex items-center gap-1"
                  title="Hyperlink (<a href='url'>link</a>)"
                >
                  <Link className="w-3 h-3" /> Link
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Quick Emoji Toolbar */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                  {QUICK_EMOJIS.slice(0, 8).map(em => (
                    <button
                      key={em}
                      onClick={() => insertEmoji(em)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-sm"
                      title={`Insert ${em}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Textarea */}
              <textarea
                rows={4}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Enter Telegram message with HTML formatting..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 leading-relaxed"
              />
            </div>

            {/* 2. Interactive Keyboard Grid Builder */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Grid className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Keyboard Grid Layout</h3>
                </div>

                {/* Keyboard Type: Inline vs Reply */}
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setKeyboardType('inline')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      keyboardType === 'inline'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Inline Keyboard (Buttons under message)
                  </button>
                  <button
                    onClick={() => setKeyboardType('reply')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      keyboardType === 'reply'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Reply Keyboard (Bottom menu)
                  </button>
                </div>
              </div>

              {/* Quick Layout Presets */}
              <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Layout Presets:
                </span>
                {(['1x1', '1x2', '2x2', '3x1', '3x2'] as const).map(preset => (
                  <button
                    key={preset}
                    onClick={() => applyPresetLayout(preset)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-medium text-slate-300 border border-slate-700"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Visual Keyboard Rows Container */}
              <div className="space-y-3 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                {rows.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-1.5">
                      <span className="font-semibold text-slate-300">Row {rIdx + 1} ({row.length} buttons)</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAddButtonToRow(rIdx)}
                          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                          title="Add button in this row"
                        >
                          <Plus className="w-3 h-3" /> Add Button
                        </button>
                        <button
                          onClick={() => handleRemoveRow(rIdx)}
                          className="text-rose-400 hover:text-rose-300 ml-2"
                          title="Delete entire row"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Buttons in this row */}
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                      {row.map((btn, cIdx) => {
                        const isSelected =
                          editingCoord && editingCoord[0] === rIdx && editingCoord[1] === cIdx;
                        return (
                          <div
                            key={cIdx}
                            onClick={() => setEditingCoord([rIdx, cIdx])}
                            className={`p-2 rounded-lg cursor-pointer text-center text-xs font-medium transition-all relative group flex flex-col justify-center items-center gap-1 border ${
                              isSelected
                                ? 'bg-cyan-600/20 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-500'
                                : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            <span className="truncate w-full font-semibold">{btn.text}</span>
                            <span className="text-[10px] text-slate-400 truncate w-full flex items-center justify-center gap-1">
                              {btn.type === 'url' ? <ExternalLink className="w-2.5 h-2.5" /> : <Code className="w-2.5 h-2.5" />}
                              {btn.value}
                            </span>

                            {/* Delete single button button */}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleRemoveButton(rIdx, cIdx);
                              }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete button"
                            >
                              &times;
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Add New Row Button */}
                <button
                  onClick={handleAddRow}
                  className="w-full py-2 border-2 border-dashed border-slate-700 hover:border-cyan-500 text-slate-400 hover:text-cyan-300 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Keyboard Row
                </button>
              </div>

              {/* 3. Selected Button Property Editor */}
              {currentEditingButton && editingCoord && (
                <div className="bg-slate-950 p-3.5 rounded-lg border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5" /> Editing Button [Row {editingCoord[0] + 1}, Col {editingCoord[1] + 1}]
                    </span>
                    {/* Quick Emojis for Button */}
                    <div className="flex items-center gap-1">
                      {QUICK_EMOJIS.slice(0, 6).map(em => (
                        <button
                          key={em}
                          onClick={() => insertEmoji(em)}
                          className="text-xs hover:scale-125 transition-transform"
                          title="Add emoji"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Button Label */}
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">Button Label</label>
                      <input
                        type="text"
                        value={currentEditingButton.text}
                        onChange={e => updateCurrentButton('text', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Action Type */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">Action Type</label>
                      <select
                        value={currentEditingButton.type}
                        onChange={e => updateCurrentButton('type', e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="callback_data">Callback Data</option>
                        <option value="url">URL Link</option>
                        <option value="web_app">Mini App URL</option>
                      </select>
                    </div>

                    {/* Action Value */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                        {currentEditingButton.type === 'url' ? 'Target URL' : 'Payload String'}
                      </label>
                      <input
                        type="text"
                        value={currentEditingButton.value}
                        onChange={e => updateCurrentButton('value', e.target.value)}
                        placeholder={currentEditingButton.type === 'url' ? 'https://...' : 'cmd_action'}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save directly to Bot Commands */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Save as Command /</span>
                <input
                  type="text"
                  value={saveCommandName}
                  onChange={e => setSaveCommandName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="menu"
                  className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                />
                <span className="text-xs text-slate-400">into <b>{selectedBot?.name}</b></span>
              </div>

              <button
                onClick={handleSaveToBot}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-colors"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Saved to Bot Commands!
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> Save Command
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Live Telegram Device Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Live Telegram Preview</h3>
                </div>
                <span className="text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Interactive Simulation
                </span>
              </div>

              {/* Mock Telegram Chat Container */}
              <div className="bg-[#0e1621] border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
                {/* Mock Header */}
                <div className="bg-[#17212b] px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow">
                      {selectedBot ? selectedBot.name.charAt(0) : 'B'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white leading-tight">
                          {selectedBot?.name || 'Nexus Bot'}
                        </span>
                        <span className="w-3 h-3 rounded-full bg-cyan-500 text-[9px] text-white flex items-center justify-center">
                          ✓
                        </span>
                      </div>
                      <span className="text-[10px] text-cyan-400 block leading-tight">bot</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400">Telegram 10.4</div>
                </div>

                {/* Chat Stream Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col justify-end bg-[#0e1621] relative">
                  {/* Watermark / Pattern */}
                  <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
                    <BotIcon className="w-48 h-48 text-white" />
                  </div>

                  {/* Incoming user message placeholder */}
                  <div className="self-end max-w-[80%] bg-[#2b5278] text-white text-xs px-3 py-1.5 rounded-2xl rounded-tr-sm shadow">
                    <span>/{saveCommandName}</span>
                    <span className="text-[9px] text-cyan-200 float-right ml-2 mt-1">12:00</span>
                  </div>

                  {/* Bot Outbound Reply Bubble */}
                  <div className="self-start max-w-[92%] space-y-1.5">
                    <div className="bg-[#182533] border border-[#232e3c] text-white rounded-2xl rounded-tl-sm p-3.5 shadow-lg relative">
                      {/* Parsed Message HTML */}
                      <div
                        className="text-xs text-slate-100 leading-relaxed font-sans prose prose-invert max-w-none break-words"
                        dangerouslySetInnerHTML={{ __html: messageText }}
                      />
                      <span className="text-[9px] text-slate-400 float-right mt-1">
                        12:00 PM · Bot
                      </span>
                    </div>

                    {/* Inline Keyboard Rendered in Telegram Bubble Style */}
                    {keyboardType === 'inline' && rows.length > 0 && (
                      <div className="space-y-1 pt-0.5">
                        {rows.map((row, rI) => (
                          <div
                            key={rI}
                            className="grid gap-1"
                            style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                          >
                            {row.map((btn, cI) => (
                              <button
                                key={cI}
                                onClick={() => handlePreviewButtonClick(btn)}
                                className="w-full py-2 px-2 bg-[#202b36] hover:bg-[#2b3a4a] text-[#6ab2f2] hover:text-white text-xs font-medium rounded-lg text-center shadow-sm transition-all truncate border border-[#2b3848]/60 active:scale-95"
                              >
                                {btn.text}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Interactive click notification */}
                  {previewClickedData && (
                    <div className="p-2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] text-center animate-bounce">
                      {previewClickedData}
                    </div>
                  )}
                </div>

                {/* Reply Keyboard Rendered at Bottom Bar (if type === 'reply') */}
                {keyboardType === 'reply' && rows.length > 0 && (
                  <div className="bg-[#17212b] p-2 border-t border-slate-800 space-y-1">
                    {rows.map((row, rI) => (
                      <div
                        key={rI}
                        className="grid gap-1"
                        style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                      >
                        {row.map((btn, cI) => (
                          <button
                            key={cI}
                            onClick={() => handlePreviewButtonClick(btn)}
                            className="w-full py-2 bg-[#242f3d] hover:bg-[#2e3b4d] text-slate-200 text-xs font-medium rounded text-center shadow transition-colors truncate"
                          >
                            {btn.text}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Mock Bottom Input Bar */}
                <div className="bg-[#17212b] px-3 py-2 border-t border-slate-800 flex items-center gap-2">
                  <Smile className="w-4 h-4 text-slate-400" />
                  <div className="flex-1 bg-[#242f3d] rounded-full px-3 py-1 text-xs text-slate-400">
                    Write a message...
                  </div>
                  <Send className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'json' ? (
        /* JSON Payload Viewer */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Telegram API JSON Payload (sendMessage)</h3>
            </div>
            <button
              onClick={() => handleCopy(JSON.stringify(generatePayload(), null, 2))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied JSON' : 'Copy Payload'}
            </button>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
            {JSON.stringify(generatePayload(), null, 2)}
          </pre>
        </div>
      ) : (
        /* Telegraf.js / Node-Telegram-Bot-API Code Snippet */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Telegraf.js / Node.js Production Code</h3>
            </div>
            <button
              onClick={() => handleCopy(generateTelegrafCode())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Code' : 'Copy Code Snippet'}
            </button>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
            {generateTelegrafCode()}
          </pre>
        </div>
      )}
    </div>
  );
};

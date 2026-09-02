import React, { useState, useRef, useEffect } from 'react';
import {
  Smartphone,
  Send,
  Trash2,
  RefreshCw,
  Sparkles,
  Command,
  ExternalLink,
  ChevronRight,
  User,
  Check,
  CheckCheck
} from 'lucide-react';
import { TelegramBot, BotCommand } from '../types';

interface EmulatorMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  inlineButtons?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
  replyButtons?: string[][];
  command?: string;
}

interface EmulatorTabProps {
  bot: TelegramBot | null;
  commands: BotCommand[];
  onRefreshData: () => void;
}

export const EmulatorTab: React.FC<EmulatorTabProps> = ({ bot, commands, onRefreshData }) => {
  const [messages, setMessages] = useState<EmulatorMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text:
        '👋 <b>Welcome to the Live Telegram Emulator!</b>\n\n' +
        'This client simulator executes your bot commands, auto-responders, inline buttons, and Gemini AI conversational fallback in real time.\n\n' +
        'Try typing <code>/start</code> or click any button below!',
      time: '12:00',
      inlineButtons: [
        [
          { text: '🚀 /start', callback_data: 'cmd_start' },
          { text: 'ℹ️ /help', callback_data: 'cmd_help' },
        ],
        [
          { text: '💎 /pricing', callback_data: 'cmd_pricing' },
          { text: '🎧 /support', callback_data: 'cmd_support' },
        ],
      ],
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [activeReplyKeyboard, setActiveReplyKeyboard] = useState<string[][] | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [activeSimUser, setActiveSimUser] = useState({ id: 98124501, name: 'Elena Rostova' });
  const [showCommandsPopup, setShowCommandsPopup] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  if (!bot) {
    return <div className="p-8 text-center text-slate-400">Please select a bot.</div>;
  }

  const sendUpdate = async (text?: string, callbackData?: string) => {
    const userText = text || (callbackData ? `[Clicked: ${callbackData}]` : '');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append user bubble (unless callback query)
    if (text) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'user',
          text: userText,
          time: nowTime,
        },
      ]);
    }

    setIsTyping(true);
    try {
      const res = await fetch(`/api/bots/${bot._id}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          callbackData,
          telegramId: activeSimUser.id,
          senderName: activeSimUser.name,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        const reply = data.data;
        setMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: 'bot',
            text: reply.replyText || 'No reply generated.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            inlineButtons: reply.replyMarkup?.inline_keyboard,
            replyButtons: reply.replyMarkup?.keyboard?.map((row: any[]) => row.map(b => b.text)),
            command: reply.command,
          },
        ]);

        if (reply.replyMarkup?.keyboard) {
          setActiveReplyKeyboard(reply.replyMarkup.keyboard.map((row: any[]) => row.map(b => b.text)));
        }

        onRefreshData();
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const sendVal = inputText.trim();
    setInputText('');
    setShowCommandsPopup(false);
    sendUpdate(sendVal);
  };

  const handleButtonClick = (btn: { text: string; url?: string; callback_data?: string }) => {
    if (btn.url) {
      window.open(btn.url, '_blank');
      return;
    }
    if (btn.callback_data) {
      sendUpdate(undefined, btn.callback_data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Interactive Telegram Simulator</h2>
          <p className="text-xs text-slate-400">
            Real-time visual test environment. Verify custom slash commands, rich inline buttons, and Gemini AI.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Simulation User Switcher */}
          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
            <User className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Testing as:</span>
            <select
              value={activeSimUser.name}
              onChange={e => {
                if (e.target.value === 'Elena Rostova') {
                  setActiveSimUser({ id: 98124501, name: 'Elena Rostova' });
                } else if (e.target.value === 'Marcus Vance') {
                  setActiveSimUser({ id: 44291048, name: 'Marcus Vance' });
                } else {
                  setActiveSimUser({ id: Math.floor(Math.random() * 900000) + 100000, name: 'New Visitor' });
                }
              }}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="Elena Rostova" className="bg-slate-900">Elena Rostova (VIP)</option>
              <option value="Marcus Vance" className="bg-slate-900">Marcus Vance (Pro)</option>
              <option value="New Visitor" className="bg-slate-900">New Visitor (Guest)</option>
            </select>
          </div>

          <button
            onClick={() => setMessages([])}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs transition"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Realistic Telegram Phone / Client Frame */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#0e1621] border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[640px] relative">
          {/* Telegram Header */}
          <div className="bg-[#17212b] border-b border-[#242f3d] px-4 py-3 flex items-center justify-between z-10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold shadow">
                🤖
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-sm font-bold text-white">{bot.name}</h3>
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1 py-0.2 rounded font-semibold uppercase">
                    bot
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isTyping ? (
                    <span className="text-sky-400 animate-pulse font-medium">typing...</span>
                  ) : (
                    `@${bot.username} • online`
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => sendUpdate('/start')}
                className="px-2.5 py-1 bg-[#242f3d] hover:bg-[#2b394a] text-sky-400 font-mono text-[11px] rounded-lg transition"
              >
                /start
              </button>
              <button
                onClick={() => sendUpdate('/help')}
                className="px-2.5 py-1 bg-[#242f3d] hover:bg-[#2b394a] text-sky-400 font-mono text-[11px] rounded-lg transition"
              >
                /help
              </button>
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0e1621] bg-[radial-gradient(#17212b_1px,transparent_1px)] [background-size:16px_16px]">
            {messages.map(msg => {
              const isUser = msg.sender === 'user';

              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] sm:max-w-md rounded-2xl p-3 text-xs shadow-md ${
                      isUser
                        ? 'bg-[#2b5278] text-white rounded-br-none'
                        : 'bg-[#182533] text-slate-100 rounded-bl-none border border-[#242f3d]'
                    }`}
                  >
                    {!isUser && (
                      <div className="text-[11px] font-bold text-sky-400 mb-1 flex items-center justify-between">
                        <span>{bot.name}</span>
                        {msg.command && (
                          <span className="text-[9px] font-mono text-slate-400">/{msg.command}</span>
                        )}
                      </div>
                    )}

                    <div
                      className="space-y-1 text-xs leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: msg.text }}
                    />

                    <div className="flex items-center justify-end space-x-1 mt-1 text-[9px] text-slate-400">
                      <span>{msg.time}</span>
                      {isUser && <CheckCheck className="w-3 h-3 text-sky-300" />}
                    </div>
                  </div>

                  {/* Inline Keyboard Buttons */}
                  {msg.inlineButtons && msg.inlineButtons.length > 0 && (
                    <div className="mt-1.5 max-w-[85%] sm:max-w-md space-y-1">
                      {msg.inlineButtons.map((row, rowIdx) => (
                        <div key={rowIdx} className="flex gap-1.5 flex-wrap">
                          {row.map((btn, btnIdx) => (
                            <button
                              key={btnIdx}
                              onClick={() => handleButtonClick(btn)}
                              className="flex-1 min-w-[120px] py-1.5 px-3 bg-[#242f3d]/90 hover:bg-[#2b394a] active:scale-95 text-sky-300 rounded-xl text-xs font-medium border border-sky-500/20 text-center transition flex items-center justify-center space-x-1"
                            >
                              <span>{btn.text}</span>
                              {btn.url && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center space-x-1.5 p-3 rounded-2xl bg-[#182533] rounded-bl-none border border-[#242f3d] w-20">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Slash Commands Suggestion Popup */}
          {showCommandsPopup && (
            <div className="absolute bottom-16 left-4 right-4 bg-[#17212b] border border-[#242f3d] rounded-2xl p-2 shadow-2xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-800">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Available Commands
              </div>
              {commands.map(c => (
                <button
                  key={c._id}
                  onClick={() => {
                    setInputText(`/${c.command}`);
                    setShowCommandsPopup(false);
                    sendUpdate(`/${c.command}`);
                  }}
                  className="w-full text-left p-2 hover:bg-[#242f3d] rounded-xl flex items-center justify-between text-xs transition"
                >
                  <span className="font-mono font-bold text-sky-400">/{c.command}</span>
                  <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {c.description}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Active Reply Keyboard (if any) */}
          {activeReplyKeyboard && (
            <div className="bg-[#17212b] border-t border-[#242f3d] p-2 space-y-1.5">
              {activeReplyKeyboard.map((row, rIdx) => (
                <div key={rIdx} className="flex gap-1.5">
                  {row.map((btnText, bIdx) => (
                    <button
                      key={bIdx}
                      onClick={() => sendUpdate(btnText)}
                      className="flex-1 py-1.5 px-3 bg-[#242f3d] hover:bg-[#2b394a] text-slate-200 rounded-xl text-xs font-medium border border-slate-700/60 transition"
                    >
                      {btnText}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Chat Input Bar */}
          <form
            onSubmit={handleFormSubmit}
            className="bg-[#17212b] border-t border-[#242f3d] p-3 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setShowCommandsPopup(!showCommandsPopup)}
              className="p-2 text-slate-400 hover:text-sky-400 hover:bg-[#242f3d] rounded-xl transition"
              title="Show bot commands"
            >
              <Command className="w-4 h-4" />
            </button>

            <input
              type="text"
              placeholder="Write a message or /command..."
              value={inputText}
              onChange={e => {
                const val = e.target.value;
                setInputText(val);
                if (val === '/') setShowCommandsPopup(true);
                else if (!val.startsWith('/')) setShowCommandsPopup(false);
              }}
              className="flex-1 bg-[#242f3d] border border-transparent focus:border-sky-500 rounded-2xl px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none transition"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-full transition shadow-md shadow-sky-600/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  Pause,
  Trash2,
  Copy,
  Download,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio,
  Send,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { TelegramBot } from '../types';
import { io, Socket } from 'socket.io-client';

interface TerminalLogItem {
  id: string;
  level: 'info' | 'warn' | 'error' | 'webhook';
  event: string;
  details: string;
  botId?: string;
  botName?: string;
  timestamp: string;
  payload?: any;
}

interface TerminalProps {
  bots: TelegramBot[];
  selectedBotId: string;
  onSelectBot: (id: string) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ bots, selectedBotId, onSelectBot }) => {
  const [logs, setLogs] = useState<TerminalLogItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'webhook' | 'info' | 'warn' | 'error'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBotOnly, setFilterBotOnly] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [testEventType, setTestEventType] = useState('INCOMING_MESSAGE');
  const [testEventText, setTestEventText] = useState('Hello bot! Please show pricing options.');
  const [isSimulating, setIsSimulating] = useState(false);
  const [copied, setCopied] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const selectedBot = bots.find(b => b._id === selectedBotId) || bots[0];

  // Fetch initial logs and connect Socket.io + fallback polling
  useEffect(() => {
    // 1. Fetch initial snapshot from REST API
    fetch('/api/terminal/logs')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setLogs(data.data);
        } else {
          // Provide an initial welcoming system log
          setLogs([
            {
              id: 'init_1',
              level: 'info',
              event: 'SYSTEM_READY',
              details: 'Telegram Bot Platform daemon initialized. Multi-tenant socket streaming active.',
              timestamp: new Date().toISOString(),
              botName: 'Core Gateway',
            },
            {
              id: 'init_2',
              level: 'webhook',
              event: 'GATEWAY_ONLINE',
              details: 'Listening on port 3000 at /api/telegram/webhook/:botId for live Telegram API webhooks.',
              timestamp: new Date().toISOString(),
              botName: 'Webhook Router',
            },
          ]);
        }
      })
      .catch(() => {
        // Fallback
      });

    // 2. Initialize Socket.io connection
    try {
      const socket = io({
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      socket.on('terminal_init', (serverLogs: TerminalLogItem[]) => {
        if (Array.isArray(serverLogs) && serverLogs.length > 0) {
          setLogs(prev => {
            const ids = new Set(prev.map(p => p.id));
            const fresh = serverLogs.filter(l => !ids.has(l.id));
            return [...prev, ...fresh].slice(-200);
          });
        }
      });

      socket.on('terminal_log', (newLog: TerminalLogItem) => {
        if (!isPaused) {
          setLogs(prev => [...prev.slice(-200), newLog]);
        }
      });
    } catch (e) {
      console.warn('[Terminal] Socket connection error:', e);
    }

    // 3. Fallback periodic sync (ensures preview updates even if WebSockets are throttled)
    const interval = setInterval(() => {
      if (!isPaused) {
        fetch('/api/terminal/logs')
          .then(res => res.json())
          .then(data => {
            if (data.success && Array.isArray(data.data)) {
              setLogs(prev => {
                const existingMap = new Set(prev.map(p => p.id));
                const additions = data.data.filter((l: TerminalLogItem) => !existingMap.has(l.id));
                if (additions.length > 0) {
                  return [...prev, ...additions].slice(-200);
                }
                return prev;
              });
            }
          })
          .catch(() => {});
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isPaused]);

  // Auto scroll effect
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Level filter
      if (filterLevel !== 'ALL' && log.level !== filterLevel) {
        return false;
      }
      // Bot filter
      if (filterBotOnly && selectedBotId && log.botId && log.botId !== selectedBotId) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inDetails = log.details.toLowerCase().includes(query);
        const inEvent = log.event.toLowerCase().includes(query);
        const inBot = (log.botName || '').toLowerCase().includes(query);
        return inDetails || inEvent || inBot;
      }
      return true;
    });
  }, [logs, filterLevel, filterBotOnly, selectedBotId, searchQuery]);

  // Send simulated test event
  const handleTriggerTest = async () => {
    if (!selectedBot) return;
    setIsSimulating(true);

    try {
      if (testEventType === 'INCOMING_MESSAGE') {
        await fetch(`/api/bots/${selectedBot._id}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: testEventText || 'Hello bot!',
            senderName: 'Test Developer',
            telegramId: 88776655,
          }),
        });
      } else if (testEventType === 'CALLBACK_QUERY') {
        await fetch(`/api/bots/${selectedBot._id}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callbackData: 'cmd_help',
            senderName: 'Test Developer',
            telegramId: 88776655,
          }),
        });
      } else if (testEventType === 'SYSTEM_ERROR') {
        if (socketRef.current) {
          socketRef.current.emit('simulate_event', {
            level: 'error',
            event: 'TELEGRAM_GATEWAY_TIMEOUT',
            details: 'Connection to Telegram Bot API timed out (simulated debug warning)',
            botId: selectedBot._id,
            botName: selectedBot.name,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.event}] ${l.details}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telegram-bot-terminal-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    } catch {
      return ts;
    }
  };

  const getBadgeStyle = (level: string) => {
    switch (level) {
      case 'webhook':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'error':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'warn':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'info':
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TerminalIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Live Console Terminal</h2>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isConnected ? 'Socket.io Connected' : 'Polling Stream Active'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time multi-tenant event pipeline: streaming inbound updates, auto-replies, and system events.
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Bot Select */}
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

          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          {/* Auto Scroll */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoScroll
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* Copy */}
          <button
            onClick={handleCopyLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
            title="Copy logs to clipboard"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          {/* Download */}
          <button
            onClick={handleDownloadLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
            title="Export JSON"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          {/* Clear */}
          <button
            onClick={() => setLogs([])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20"
            title="Clear terminal buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Filter & Testing Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Filter Levels */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'webhook', 'info', 'warn', 'error'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-2.5 py-1 rounded-md font-mono uppercase font-semibold text-[11px] transition-colors border ${
                filterLevel === lvl
                  ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterBotOnly}
              onChange={e => setFilterBotOnly(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-cyan-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span>Only this bot</span>
          </label>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search events or payloads..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Main Terminal Window */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden font-mono text-xs">
        {/* Terminal Title Bar */}
        <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-slate-400 font-medium ml-2 text-[11px]">
              telegram-gateway-daemon (stdout / socket.io)
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Buffer: {filteredLogs.length} events</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" /> LIVE
            </span>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-4 h-[420px] overflow-y-auto space-y-1.5 bg-slate-950/90 selection:bg-cyan-500/30 selection:text-cyan-200">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-500 text-center py-16 flex flex-col items-center justify-center">
              <TerminalIcon className="w-8 h-8 mb-2 opacity-30" />
              <p>No log events match your filter criteria.</p>
              <p className="text-[11px] mt-1">Use the Quick Simulator below to dispatch a live test event.</p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div
                  key={log.id}
                  className="group hover:bg-slate-900/60 p-1.5 rounded transition-colors border border-transparent hover:border-slate-800"
                >
                  <div className="flex items-start gap-2.5">
                    {/* Timestamp */}
                    <span className="text-slate-500 text-[11px] whitespace-nowrap pt-0.5">
                      {formatTime(log.timestamp)}
                    </span>

                    {/* Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border whitespace-nowrap ${getBadgeStyle(
                        log.level
                      )}`}
                    >
                      {log.level}
                    </span>

                    {/* Event Tag */}
                    <span className="text-cyan-400 font-semibold text-[11px] whitespace-nowrap pt-0.5">
                      {log.event}:
                    </span>

                    {/* Details */}
                    <span className="text-slate-200 flex-1 break-all pt-0.5">
                      {log.details}
                    </span>

                    {/* Bot Name Tag if present */}
                    {log.botName && (
                      <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700 whitespace-nowrap">
                        {log.botName}
                      </span>
                    )}

                    {/* Payload Expand Toggle */}
                    {log.payload && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-slate-500 hover:text-cyan-400 text-[10px] flex items-center gap-0.5 pt-0.5"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        JSON
                      </button>
                    )}
                  </div>

                  {/* Collapsible JSON payload */}
                  {isExpanded && log.payload && (
                    <div className="mt-2 ml-20 bg-slate-900 border border-slate-800 rounded p-2 text-[11px] text-emerald-400 overflow-x-auto">
                      <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Bottom Status Line */}
        <div className="bg-slate-900/90 px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Ready for incoming Telegram Webhooks & API events</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Encoding: UTF-8</span>
            <span>Target: {selectedBot ? selectedBot.name : 'All Bots'}</span>
          </div>
        </div>
      </div>

      {/* Quick Event Simulation Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Live Event Injector</h3>
            <span className="text-xs text-slate-400">
              Test your auto-replies, keyword triggers, and socket stream instantaneously.
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch gap-2.5">
          {/* Event Type Select */}
          <select
            value={testEventType}
            onChange={e => setTestEventType(e.target.value)}
            className="bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-500 font-medium"
          >
            <option value="INCOMING_MESSAGE">Inbound User Message</option>
            <option value="CALLBACK_QUERY">Inline Button Callback (/cmd_help)</option>
            <option value="SYSTEM_ERROR">Simulated System Warning</option>
          </select>

          {/* Event text input */}
          {testEventType === 'INCOMING_MESSAGE' ? (
            <input
              type="text"
              value={testEventText}
              onChange={e => setTestEventText(e.target.value)}
              placeholder="Enter message text (e.g. /start, /help, or pricing)"
              className="flex-1 bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
              onKeyDown={e => {
                if (e.key === 'Enter') handleTriggerTest();
              }}
            />
          ) : (
            <div className="flex-1 flex items-center px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400">
              {testEventType === 'CALLBACK_QUERY'
                ? 'Simulates Telegram user clicking an inline keyboard button (cmd_help).'
                : 'Simulates API connection failure event in terminal stream.'}
            </div>
          )}

          {/* Fire button */}
          <button
            onClick={handleTriggerTest}
            disabled={isSimulating}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow transition-colors disabled:opacity-50"
          >
            {isSimulating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {isSimulating ? 'Injecting...' : 'Dispatch Event'}
          </button>
        </div>
      </div>
    </div>
  );
};

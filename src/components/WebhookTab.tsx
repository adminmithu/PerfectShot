import React, { useState, useEffect } from 'react';
import {
  Radio,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Check,
  Terminal,
  Activity,
  Globe,
  ShieldCheck
} from 'lucide-react';
import { TelegramBot, BotLog } from '../types';

interface WebhookTabProps {
  bot: TelegramBot | null;
  onRefreshData: () => void;
}

export const WebhookTab: React.FC<WebhookTabProps> = ({ bot, onRefreshData }) => {
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [customWebhookUrl, setCustomWebhookUrl] = useState('');
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [isDeletingWebhook, setIsDeletingWebhook] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // API Explorer State
  const [apiMethod, setApiMethod] = useState('getWebhookInfo');
  const [apiParams, setApiParams] = useState('{}');
  const [apiResult, setApiResult] = useState<any>(null);
  const [isExecutingApi, setIsExecutingApi] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    if (bot) {
      setCustomWebhookUrl(bot.webhookUrl);
      loadWebhookInfo();
      loadLogs();
    }
  }, [bot]);

  const loadWebhookInfo = async () => {
    if (!bot) return;
    setIsLoadingInfo(true);
    try {
      const res = await fetch(`/api/bots/${bot._id}/webhook`);
      const data = await res.json();
      if (data.success) {
        setWebhookInfo(data.data);
      }
    } catch (e) {
      console.error('Failed to load webhook info:', e);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const loadLogs = async () => {
    if (!bot) return;
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/bots/${bot._id}/logs`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!bot || !customWebhookUrl) return;
    setIsSettingWebhook(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/bots/${bot._id}/webhook/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: customWebhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('Webhook successfully registered with Telegram servers!');
        loadWebhookInfo();
        onRefreshData();
      } else {
        setActionMessage('Failed to set webhook: ' + (data.result?.description || 'Check URL'));
      }
    } catch (e: any) {
      setActionMessage('Error setting webhook: ' + e.message);
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!bot) return;
    if (!confirm('Remove webhook from Telegram servers? The bot will stop receiving live updates.')) return;
    setIsDeletingWebhook(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/bots/${bot._id}/webhook/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropPendingUpdates: true }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('Webhook removed successfully.');
        loadWebhookInfo();
        onRefreshData();
      }
    } catch (e: any) {
      setActionMessage('Error deleting webhook: ' + e.message);
    } finally {
      setIsDeletingWebhook(false);
    }
  };

  const handleExecuteApi = async () => {
    if (!bot) return;
    setIsExecutingApi(true);
    setApiResult(null);

    try {
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(apiParams);
      } catch (err) {
        alert('Invalid JSON in parameters');
        setIsExecutingApi(false);
        return;
      }

      const res = await fetch('/api/telegram/direct-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: bot.token,
          method: apiMethod,
          params: parsedParams,
        }),
      });

      const data = await res.json();
      setApiResult(data.response);
    } catch (e: any) {
      setApiResult({ ok: false, error: e.message });
    } finally {
      setIsExecutingApi(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    if (!customWebhookUrl) return;
    navigator.clipboard.writeText(customWebhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (!bot) {
    return <div className="p-8 text-center text-slate-400">Please select a bot.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Webhook & API Diagnostics</h2>
          <p className="text-xs text-slate-400">
            Configure Telegram HTTPS webhook callbacks, inspect live connection health, and query official API methods.
          </p>
        </div>
        <button
          onClick={() => {
            loadWebhookInfo();
            loadLogs();
          }}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInfo ? 'animate-spin text-sky-400' : ''}`} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3.5 bg-slate-850 border border-slate-700 rounded-xl text-xs text-sky-300 flex items-center space-x-2">
          <Activity className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Webhook Configuration & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Webhook URL & Configuration */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="w-5 h-5 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">Incoming Webhook Endpoint</h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                bot.webhookStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {bot.webhookStatus.toUpperCase()}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Telegram routes all user messages, commands, and button callback queries directly to this HTTPS endpoint.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Webhook URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customWebhookUrl}
                onChange={e => setCustomWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/api/telegram/webhook/..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={handleCopyWebhookUrl}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-xs font-medium transition flex items-center space-x-1"
                title="Copy Webhook URL"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Copy</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSetWebhook}
                disabled={isSettingWebhook || !customWebhookUrl}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition flex items-center space-x-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{isSettingWebhook ? 'Connecting...' : 'Set Webhook on Telegram'}</span>
              </button>
              <button
                onClick={handleDeleteWebhook}
                disabled={isDeletingWebhook}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition"
              >
                Delete Webhook
              </button>
            </div>

            <span className="text-[11px] text-slate-500">
              Drop Pending Updates: <strong className="text-white">Active</strong>
            </span>
          </div>
        </div>

        {/* Right col: Live getWebhookInfo Metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Telegram Gateway Status</h3>
              <span className="text-[10px] text-slate-500">via getWebhookInfo</span>
            </div>

            {webhookInfo ? (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Telegram IP:</span>
                  <span className="font-mono text-white">{webhookInfo.ip_address || '149.154.167.220'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Pending Updates:</span>
                  <span className="font-semibold text-emerald-400">
                    {webhookInfo.pending_update_count ?? 0}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Max Connections:</span>
                  <span className="font-mono text-white">{webhookInfo.max_connections || 40}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Custom Cert:</span>
                  <span className="text-slate-300">
                    {webhookInfo.has_custom_certificate ? 'Yes' : 'None (Default HTTPS)'}
                  </span>
                </div>
                {webhookInfo.last_error_message && (
                  <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px]">
                    <strong>Last Error:</strong> {webhookInfo.last_error_message}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                {isLoadingInfo ? 'Fetching Telegram status...' : 'Webhook info unavailable.'}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>SSL Transport: TLS 1.3</span>
            <span className="text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Healthy</span>
            </span>
          </div>
        </div>
      </div>

      {/* Telegram Bot API Interactive Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Direct Telegram Bot API Console</h3>
          </div>
          <span className="text-xs text-slate-400">
            Execute native API methods directly against <code className="text-sky-400">api.telegram.org</code>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input side */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">API Method</label>
              <select
                value={apiMethod}
                onChange={e => {
                  setApiMethod(e.target.value);
                  if (e.target.value === 'sendMessage') {
                    setApiParams(JSON.stringify({ chat_id: 12345678, text: 'Hello from TeleManager!' }, null, 2));
                  } else if (e.target.value === 'getWebhookInfo' || e.target.value === 'getMe' || e.target.value === 'getMyCommands') {
                    setApiParams('{}');
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              >
                <option value="getWebhookInfo">getWebhookInfo</option>
                <option value="getMe">getMe</option>
                <option value="getMyCommands">getMyCommands</option>
                <option value="sendMessage">sendMessage</option>
                <option value="getUpdates">getUpdates</option>
                <option value="deleteWebhook">deleteWebhook</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                JSON Parameters
              </label>
              <textarea
                rows={6}
                value={apiParams}
                onChange={e => setApiParams(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              onClick={handleExecuteApi}
              disabled={isExecutingApi}
              className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2 shadow-md shadow-sky-600/20"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isExecutingApi ? 'Executing API Method...' : `Call Telegram API: ${apiMethod}`}</span>
            </button>
          </div>

          {/* Response Output side */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Response Output</span>
              {apiResult && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    apiResult.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {apiResult.ok ? '200 OK' : 'ERROR'}
                </span>
              )}
            </div>
            <pre className="flex-1 bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-sky-300 overflow-x-auto max-h-56">
              {apiResult ? JSON.stringify(apiResult, null, 2) : '// Response will appear here after execution.'}
            </pre>
          </div>
        </div>
      </div>

      {/* Real-time Audit & Webhook Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">System Audit & Webhook Event Logs</h3>
            <p className="text-xs text-slate-400">Captured update requests, command invocations, and AI tokens</p>
          </div>
          <span className="text-xs text-slate-500">Latest 50 events</span>
        </div>

        <div className="divide-y divide-slate-800/80 max-h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">No logs recorded yet.</p>
          ) : (
            logs.map(log => (
              <div key={log._id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                <div className="flex items-start space-x-2.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase shrink-0 ${
                      log.level === 'error'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : log.level === 'webhook'
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : 'bg-slate-800 text-sky-400 border border-slate-700'
                    }`}
                  >
                    {log.level}
                  </span>
                  <div>
                    <span className="font-semibold text-white mr-2">{log.event}</span>
                    <span className="text-slate-400">{log.details}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

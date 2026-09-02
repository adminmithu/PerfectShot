import React, { useState } from 'react';
import { Bot, RefreshCw, Smartphone, Plus, ShieldCheck, AlertCircle, ExternalLink, Database, Terminal, Layers } from 'lucide-react';
import { TelegramBot, TabType } from '../types';

interface HeaderProps {
  bots: TelegramBot[];
  selectedBot: TelegramBot | null;
  onSelectBot: (bot: TelegramBot) => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenAddBot: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  bots,
  selectedBot,
  onSelectBot,
  activeTab,
  onTabChange,
  onOpenAddBot,
  onRefresh,
  isRefreshing,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <Bot className="w-4 h-4" /> },
    { id: 'builder', label: 'Button Builder', icon: <Layers className="w-4 h-4 text-cyan-400" /> },
    { id: 'terminal', label: 'Live Terminal', icon: <Terminal className="w-4 h-4 text-emerald-400" /> },
    { id: 'bots', label: 'Bot Fleet', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'commands', label: 'Commands', icon: <span className="text-xs font-mono font-bold">/cmd</span> },
    { id: 'subscribers', label: 'Audience', icon: <span className="text-xs">👥</span> },
    { id: 'broadcasts', label: 'Broadcasts', icon: <span className="text-xs">📢</span> },
    { id: 'webhook', label: 'Webhook', icon: <span className="text-xs font-mono">⚡</span> },
    { id: 'emulator', label: 'Simulator', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'database', label: 'MongoDB', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .4z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-base tracking-tight">TeleManager</span>
                <span className="text-[10px] uppercase font-semibold bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/30">
                  Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Telegram Bot Management & Webhook Platform</p>
            </div>
          </div>

          {/* Bot Selector Dropdown & Quick Actions */}
          <div className="flex items-center space-x-3">
            {/* Active Bot Switcher */}
            <div className="relative">
              <button
                id="bot-selector-dropdown-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2.5 bg-slate-800/90 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-700/80 transition shadow-sm text-sm"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium max-w-[140px] sm:max-w-[200px] truncate">
                  {selectedBot ? selectedBot.name : 'Select Bot'}
                </span>
                <span className="text-xs text-slate-400 hidden md:inline">
                  @{selectedBot?.username || 'none'}
                </span>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 z-50">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
                    Configured Bots ({bots.length})
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-700/40">
                    {bots.map(b => (
                      <button
                        key={b._id}
                        onClick={() => {
                          onSelectBot(b);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-slate-700/60 flex items-center justify-between transition ${
                          selectedBot?._id === b._id ? 'bg-sky-500/10 text-sky-400 font-medium' : 'text-slate-200'
                        }`}
                      >
                        <div className="truncate">
                          <p className="text-sm truncate">{b.name}</p>
                          <p className="text-xs text-slate-400 truncate">@{b.username}</p>
                        </div>
                        {b.isVerified ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 border-t border-slate-700/60">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenAddBot();
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add New Bot</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Live Terminal Quick Shortcut Button */}
            <button
              onClick={() => onTabChange('terminal')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                activeTab === 'terminal'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Open Live Deployment & Webhook Terminal Console"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Live Terminal</span>
            </button>

            {/* Quick Live Simulator Action */}
            <button
              onClick={() => onTabChange('emulator')}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 text-xs font-medium transition"
              title="Test bot in live interactive emulator"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Simulator</span>
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
              title="Refresh bot stats and updates"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-2 border-t border-slate-800/80">
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

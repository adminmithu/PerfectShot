import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { BotsTab } from './components/BotsTab';
import { CommandsTab } from './components/CommandsTab';
import { SubscribersTab } from './components/SubscribersTab';
import { BroadcastsTab } from './components/BroadcastsTab';
import { WebhookTab } from './components/WebhookTab';
import { EmulatorTab } from './components/EmulatorTab';
import { DatabaseTab } from './components/DatabaseTab';
import { Terminal } from './components/Terminal';
import { ButtonBuilder } from './components/ButtonBuilder';
import {
  TelegramBot,
  BotCommand,
  AutoResponder,
  BotSubscriber,
  BotMessage,
  BotBroadcast,
  TabType,
} from './types';

export default function App() {
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [selectedBot, setSelectedBot] = useState<TelegramBot | null>(null);
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [responders, setResponders] = useState<AutoResponder[]>([]);
  const [subscribers, setSubscribers] = useState<BotSubscriber[]>([]);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [broadcasts, setBroadcasts] = useState<BotBroadcast[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [isAddBotOpen, setIsAddBotOpen] = useState(false);
  const [isAddCommandOpen, setIsAddCommandOpen] = useState(false);
  const [isAddBroadcastOpen, setIsAddBroadcastOpen] = useState(false);

  // Load bots on mount
  const loadBots = useCallback(async () => {
    try {
      const res = await fetch('/api/bots');
      const data = await res.json();
      if (data.success && data.data) {
        setBots(data.data);
        if (!selectedBot && data.data.length > 0) {
          setSelectedBot(data.data[0]);
        } else if (selectedBot) {
          const updatedSelected = data.data.find((b: TelegramBot) => b._id === selectedBot._id);
          if (updatedSelected) setSelectedBot(updatedSelected);
        }
      }
    } catch (e) {
      console.error('Failed to load bots:', e);
    }
  }, [selectedBot]);

  // Load bot specific resources
  const loadBotResources = useCallback(async (botId: string) => {
    setIsRefreshing(true);
    try {
      const [cmdRes, respRes, subRes, msgRes, bcastRes] = await Promise.all([
        fetch(`/api/bots/${botId}/commands`).then(r => r.json()),
        fetch(`/api/bots/${botId}/responders`).then(r => r.json()),
        fetch(`/api/bots/${botId}/subscribers`).then(r => r.json()),
        fetch(`/api/bots/${botId}/logs`).then(r => r.json()), // or messages
        fetch(`/api/bots/${botId}/broadcasts`).then(r => r.json()),
      ]);

      if (cmdRes.success) setCommands(cmdRes.data);
      if (respRes.success) setResponders(respRes.data);
      if (subRes.success) setSubscribers(subRes.data);
      if (bcastRes.success) setBroadcasts(bcastRes.data);

      // Load all messages for this bot
      const allMsgsRes = await fetch(`/api/database/collections/messages`).then(r => r.json());
      if (allMsgsRes.success) {
        const botMsgs = allMsgsRes.data.filter((m: BotMessage) => m.botId === botId);
        botMsgs.sort((a: BotMessage, b: BotMessage) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setMessages(botMsgs);
      }
    } catch (e) {
      console.error('Error fetching bot resources:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBots();
  }, []);

  useEffect(() => {
    if (selectedBot) {
      loadBotResources(selectedBot._id);
    }
  }, [selectedBot?._id]);

  const handleRefresh = async () => {
    await loadBots();
    if (selectedBot) {
      await loadBotResources(selectedBot._id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Platform Header with Bot Selector & Nav */}
      <Header
        bots={bots}
        selectedBot={selectedBot}
        onSelectBot={bot => setSelectedBot(bot)}
        activeTab={activeTab}
        onTabChange={tab => setActiveTab(tab)}
        onOpenAddBot={() => setIsAddBotOpen(true)}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            bot={selectedBot}
            commands={commands}
            subscribers={subscribers}
            messages={messages}
            onTabChange={setActiveTab}
            onOpenAddCommand={() => setIsAddCommandOpen(true)}
            onOpenBroadcast={() => setIsAddBroadcastOpen(true)}
          />
        )}

        {activeTab === 'bots' && (
          <BotsTab
            bots={bots}
            selectedBot={selectedBot}
            onSelectBot={bot => setSelectedBot(bot)}
            onBotUpdated={handleRefresh}
            isAddModalOpen={isAddBotOpen}
            setIsAddModalOpen={setIsAddBotOpen}
          />
        )}

        {activeTab === 'builder' && (
          <ButtonBuilder
            bots={bots}
            selectedBotId={selectedBot?._id || ''}
            onSelectBot={id => {
              const b = bots.find(x => x._id === id);
              if (b) setSelectedBot(b);
            }}
            onSaveToCommand={() => {
              handleRefresh();
            }}
          />
        )}

        {activeTab === 'terminal' && (
          <Terminal
            bots={bots}
            selectedBotId={selectedBot?._id || ''}
            onSelectBot={id => {
              const b = bots.find(x => x._id === id);
              if (b) setSelectedBot(b);
            }}
          />
        )}

        {activeTab === 'commands' && (
          <CommandsTab
            bot={selectedBot}
            commands={commands}
            responders={responders}
            onRefreshData={handleRefresh}
            isAddModalOpen={isAddCommandOpen}
            setIsAddModalOpen={setIsAddCommandOpen}
          />
        )}

        {activeTab === 'subscribers' && (
          <SubscribersTab
            bot={selectedBot}
            subscribers={subscribers}
            onRefreshData={handleRefresh}
          />
        )}

        {activeTab === 'broadcasts' && (
          <BroadcastsTab
            bot={selectedBot}
            broadcasts={broadcasts}
            subscribers={subscribers}
            onRefreshData={handleRefresh}
            isCreateModalOpen={isAddBroadcastOpen}
            setIsCreateModalOpen={setIsAddBroadcastOpen}
          />
        )}

        {activeTab === 'webhook' && (
          <WebhookTab bot={selectedBot} onRefreshData={handleRefresh} />
        )}

        {activeTab === 'emulator' && (
          <EmulatorTab
            bot={selectedBot}
            commands={commands}
            onRefreshData={handleRefresh}
          />
        )}

        {activeTab === 'database' && <DatabaseTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-400">Telegram Bot Management Platform</span>
            <span>• Full-Stack Node.js & React</span>
          </div>

          <div className="flex items-center space-x-4">
            <span>Telegram Bot API v7.0+</span>
            <span>MongoDB Document Engine</span>
            <span>Gemini AI Integration</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

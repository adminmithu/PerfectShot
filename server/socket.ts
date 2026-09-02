import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

export interface TerminalLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'webhook';
  event: string;
  details: string;
  botId?: string;
  botName?: string;
  timestamp: string;
  payload?: any;
}

let io: SocketIOServer | null = null;
const recentLogs: TerminalLog[] = [];
const MAX_RECENT_LOGS = 100;

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['polling', 'websocket'],
  });

  io.on('connection', socket => {
    // Send buffered recent logs upon connection
    socket.emit('terminal_init', recentLogs);

    socket.on('simulate_event', data => {
      emitTerminalLog({
        level: data.level || 'info',
        event: data.event || 'MANUAL_TEST_EVENT',
        details: data.details || 'Test message sent from Terminal console',
        botId: data.botId,
        botName: data.botName,
        timestamp: new Date().toISOString(),
      });
    });
  });

  return io;
}

export function emitTerminalLog(log: Omit<TerminalLog, 'id'>) {
  const fullLog: TerminalLog = {
    ...log,
    id: 'log_' + Math.random().toString(36).substring(2, 9),
    timestamp: log.timestamp || new Date().toISOString(),
  };

  recentLogs.push(fullLog);
  if (recentLogs.length > MAX_RECENT_LOGS) {
    recentLogs.shift();
  }

  if (io) {
    io.emit('terminal_log', fullLog);
  }
}

export function getRecentLogs(): TerminalLog[] {
  return recentLogs;
}

import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { router } from './server/routes';
import { initSocketIO, getRecentLogs } from './server/socket';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // CORS Middleware for cross-origin frontend requests (e.g. Vercel -> Koyeb)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Initialize Socket.io
  initSocketIO(httpServer);

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Telegram Bot Management Platform',
      timestamp: new Date().toISOString(),
    });
  });

  // Keep-alive Cron Endpoint (For UptimeRobot / Vercel Cron / Render Keep-Alive)
  app.get('/api/cron/keep-alive', (req, res) => {
    res.json({
      status: 'awake',
      service: 'Telegram Bot Management Platform',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // Terminal logs API fallback
  app.get('/api/terminal/logs', (req, res) => {
    res.json({ success: true, data: getRecentLogs() });
  });

  // Mount API router
  app.use(router);

  // Vite middleware for development vs static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`[Server] Telegram Bot Management Platform running on http://${HOST}:${PORT}`);

    // Self-Ping Heartbeat Timer (pings every 5 minutes to prevent Render / Koyeb sleeping)
    const targetUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(async () => {
      try {
        await fetch(`${targetUrl}/api/cron/keep-alive`);
      } catch {
        // Silently ignore ping errors
      }
    }, 5 * 60 * 1000);
  });
}

startServer().catch(err => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});

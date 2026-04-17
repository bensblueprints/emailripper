import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import inboxRoutes from './routes/inboxes.js';
import oauthRoutes from './routes/oauth.js';
import campaignRoutes from './routes/campaigns.js';
import sequenceRoutes from './routes/sequences.js';
import templateRoutes from './routes/templates.js';
import leadRoutes from './routes/leads.js';
import warmupRoutes from './routes/warmup.js';
import analyticsRoutes from './routes/analytics.js';
import { migrate } from './db/migrate.js';

const app = express();
const PORT = process.env.PORT || 4100;

app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean), credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/', rateLimit({ windowMs: 60_000, max: 300 }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/inboxes', inboxRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/sequences', sequenceRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/warmup', warmupRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(errorHandler);

async function start() {
  await migrate();
  app.listen(PORT, () => logger.info({ port: PORT }, 'warmup backend listening'));
}

start().catch((err) => {
  logger.error({ err }, 'failed to start');
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';
import { classifyPreview, loadStories, loadTaxonomy } from './data.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5_000_000 } });
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'us-agent-api' }));
app.get('/api/taxonomy', (_req, res) => res.json(loadTaxonomy()));
app.get('/api/stories', async (req, res) => {
  let data = await loadStories();
  const status = String(req.query.status ?? '');
  const search = String(req.query.search ?? '').toLowerCase();
  if (status) data = data.filter(x => x.status === status);
  if (search) data = data.filter(x => `${x.text} ${x.module} ${x.operation}`.toLowerCase().includes(search));
  res.json(data.slice(0, 250));
});
app.get('/api/dashboard', async (_req, res) => {
  const data = await loadStories();
  const pending = data.filter(x => ['pending_review', 'taxonomy_gap', 'needs_rewrite'].includes(x.status)).length;
  const accepted = data.filter(x => ['accepted_auto', 'reviewed'].includes(x.status)).length;
  const avg = data.length ? data.reduce((n, x) => n + x.confidence, 0) / data.length : 0;
  const modules = Object.entries(data.reduce<Record<string, number>>((a, x) => (a[x.module] = (a[x.module] ?? 0) + 1, a), {}))
    .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  res.json({ total: data.length, pending, accepted, confidence: avg, modules });
});
app.post('/api/classify', (req, res) => {
  const parsed = z.object({ stories: z.array(z.string().min(10)).min(1).max(100), project: z.string().default('Web') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Envie de 1 a 100 histórias válidas.', details: parsed.error.issues });
  res.json({ runId: `preview-${Date.now()}`, results: parsed.data.stories.map((text, index) => ({ id: `preview-${index + 1}`, text, ...classifyPreview(text) })) });
});
app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo ausente.' });
  const text = req.file.buffer.toString('utf8');
  const stories = text.split(/\r?\n|;/).map(x => x.trim()).filter(x => x.length >= 10).slice(0, 100);
  res.json({ filename: req.file.originalname, stories });
});

app.use((_req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));
const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => console.log(`US-Agent API listening on http://localhost:${port}`));

const express = require('express');
const mongoose = require('mongoose');
const client = require('prom-client');

const app = express();
app.use(express.json({ limit: '1mb' }));

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'deployflow_http_requests_total',
  help: 'Total HTTP requests handled by DeployFlow',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const requestDuration = new client.Histogram({
  name: 'deployflow_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3],
  registers: [register]
});

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path;
    const labels = {
      method: req.method,
      route: route || 'unknown',
      status_code: String(res.statusCode)
    };
    httpRequests.inc(labels);
    requestDuration.observe(labels, Number(process.hrtime.bigint() - start) / 1e9);
  });
  next();
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 1000 },
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' }
}, { timestamps: true });

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

app.get('/', (_req, res) => {
  res.json({
    name: 'DeployFlow API',
    version: '1.0.0',
    endpoints: ['/health', '/metrics', '/api/tasks']
  });
});

app.get('/health', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'ok',
    service: 'deployflow-api',
    database: dbReady ? 'connected' : 'disconnected',
    uptimeSeconds: Math.floor(process.uptime())
  });
});

app.get('/metrics', async (_req, res, next) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    next(error);
  }
});

function requireDatabase(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is unavailable. Check MongoDB connectivity.' });
  }
  next();
}

app.get('/api/tasks', requireDatabase, async (_req, res, next) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 }).lean();
    res.json({ count: tasks.length, tasks });
  } catch (error) { next(error); }
});

app.post('/api/tasks', requireDatabase, async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'title is required' });
    const task = await Task.create({
      title,
      description: typeof req.body.description === 'string' ? req.body.description : '',
      status: req.body.status || 'todo'
    });
    res.status(201).json(task);
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ error: error.message });
    next(error);
  }
});

app.patch('/api/tasks/:id', requireDatabase, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'invalid task id' });
    }
    const allowed = {};
    for (const key of ['title', 'description', 'status']) {
      if (req.body[key] !== undefined) allowed[key] = req.body[key];
    }
    const task = await Task.findByIdAndUpdate(req.params.id, allowed, {
      new: true, runValidators: true
    });
    if (!task) return res.status(404).json({ error: 'task not found' });
    res.json(task);
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ error: error.message });
    next(error);
  }
});

app.delete('/api/tasks/:id', requireDatabase, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'invalid task id' });
    }
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'task not found' });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'internal server error' });
});

module.exports = { app, mongoose, register };

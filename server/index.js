import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const app = express();
const port = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(here, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(path.join(dataDirectory, 'waitlist.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    goal TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

app.use(express.json({ limit: '10kb' }));

app.post('/api/waitlist', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const goal = typeof req.body?.goal === 'string' ? req.body.goal.trim() : '';

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: 'Please enter a name between 2 and 80 characters.' });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (goal.length > 500) {
    return res.status(400).json({ error: 'Your goal must be 500 characters or fewer.' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO waitlist (name, email, goal) VALUES (?, ?, ?)'
    ).run(name, email, goal);
    return res.status(201).json({ message: 'You?re on the list!', id: result.lastInsertRowid });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'That email is already on the waitlist.' });
    }
    console.error('Could not save waitlist signup:', error);
    return res.status(500).json({ error: 'We couldn?t save your signup. Please try again.' });
  }
});

app.get('/api/waitlist', (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  const authorization = req.get('authorization') || '';
  const expectedToken = adminToken ? `Bearer ${adminToken}` : '';

  if (!adminToken || authorization !== expectedToken) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  try {
    const entries = db.prepare(
      'SELECT id, name, email, goal, created_at AS createdAt FROM waitlist ORDER BY created_at DESC, id DESC'
    ).all();
    return res.json({ entries });
  } catch (error) {
    console.error('Could not read waitlist:', error);
    return res.status(500).json({ error: 'We couldn?t load the waitlist.' });
  }
});

app.use(express.static(path.join(here, '..', 'dist')));
app.get('*', (_req, res, next) => {
  const indexFile = path.join(here, '..', 'dist', 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  return next();
});

app.listen(port, () => {
  console.log(`Forme API listening on http://localhost:${port}`);
});

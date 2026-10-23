import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const app = express();
const port = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(here, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(path.join(dataDirectory, 'waitlist.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    goal TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS coaches (
    coach_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    specialties TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    hourly_rate REAL NOT NULL DEFAULT 0,
    calendly_url TEXT NOT NULL,
    max_capacity INTEGER DEFAULT 15,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    fitness_focus TEXT NOT NULL,
    account_status TEXT DEFAULT 'Lead',
    assigned_coach_id TEXT,
    workout_log_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_coach_id) REFERENCES coaches(coach_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount_paid REAL NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    next_renewal_date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    coach_id TEXT NOT NULL,
    meeting_datetime DATETIME NOT NULL,
    meeting_url TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (coach_id) REFERENCES coaches(coach_id) ON DELETE CASCADE
  );
`);

const coachColumns = new Set(db.pragma('table_info(coaches)').map((column) => column.name));
if (!coachColumns.has('style')) {
  db.exec("ALTER TABLE coaches ADD COLUMN style TEXT NOT NULL DEFAULT ''");
}
if (!coachColumns.has('environment')) {
  db.exec("ALTER TABLE coaches ADD COLUMN environment TEXT NOT NULL DEFAULT ''");
}
if (!coachColumns.has('image_url')) {
  db.exec("ALTER TABLE coaches ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
}
if (!coachColumns.has('hourly_rate')) {
  db.exec('ALTER TABLE coaches ADD COLUMN hourly_rate REAL NOT NULL DEFAULT 0');
}

const initialCoaches = [
  {
    fullName: 'Maya Chen',
    specialties: 'Strength & confidence',
    style: 'Supportive',
    environment: 'Brooklyn, NY',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=720&q=85',
    hourlyRate: 85,
  },
  {
    fullName: 'Jordan Ellis',
    specialties: 'Mobility & movement',
    style: 'Mindful',
    environment: 'Silver Lake, LA',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=720&q=85',
    hourlyRate: 95,
  },
  {
    fullName: 'Amara Okafor',
    specialties: 'Running & endurance',
    style: 'Encouraging',
    environment: 'Austin, TX',
    imageUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=720&q=85',
    hourlyRate: 75,
  },
  {
    fullName: 'Leo Martinez',
    specialties: 'Strength & conditioning',
    style: 'Energetic',
    environment: 'Queens, NY',
    imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=720&q=85',
    hourlyRate: 80,
  },
];

const seedCoach = db.transaction((seedCoaches) => {
  const existingCoach = db.prepare('SELECT 1 FROM coaches WHERE full_name = ? COLLATE NOCASE');
  const lastCoach = db.prepare(
    "SELECT MAX(CAST(SUBSTR(coach_id, 5) AS INTEGER)) AS number FROM coaches WHERE coach_id GLOB 'COA-[0-9]*'"
  );
  const insertCoach = db.prepare(`
    INSERT INTO coaches (
      coach_id, full_name, specialties, style, environment, image_url, hourly_rate, calendly_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '')
  `);

  for (const coach of seedCoaches) {
    if (existingCoach.get(coach.fullName)) continue;
    const coachId = `COA-${String((lastCoach.get().number || 0) + 1).padStart(3, '0')}`;
    insertCoach.run(
      coachId,
      coach.fullName,
      coach.specialties,
      coach.style,
      coach.environment,
      coach.imageUrl,
      coach.hourlyRate
    );
  }
});
seedCoach(initialCoaches);

app.use(express.json({ limit: '10kb' }));

function isAdminAuthorized(req) {
  const adminToken = process.env.ADMIN_TOKEN;
  const authorization = req.get('authorization') || '';
  const expectedToken = adminToken ? `Bearer ${adminToken}` : '';
  return Boolean(adminToken) && authorization === expectedToken;
}

function isValidImageUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

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

const focusKeywords = {
  'Build strength': ['strength', 'conditioning'],
  'Cardio & endurance': ['cardio', 'endurance', 'running'],
  'Flexibility & mobility': ['flexibility', 'mobility', 'movement'],
  'Energy & health': ['health', 'wellness', 'confidence', 'strength'],
};

function matchCoach(fitnessFocus) {
  const coaches = db.prepare(
    'SELECT coach_id AS coachId, full_name AS fullName, specialties, style FROM coaches WHERE is_active = 1 ORDER BY full_name COLLATE NOCASE'
  ).all();
  const keywords = focusKeywords[fitnessFocus];
  if (!keywords || coaches.length === 0) return null;

  const rankedCoaches = coaches.map((coach) => {
    const details = `${coach.specialties} ${coach.style}`.toLowerCase();
    const score = keywords.reduce((total, keyword) => total + (details.includes(keyword) ? 1 : 0), 0);
    return { ...coach, score };
  }).filter((coach) => coach.score > 0)
    .sort((left, right) => right.score - left.score || left.fullName.localeCompare(right.fullName));

  return rankedCoaches[0] || null;
}

app.post('/api/intake', (req, res) => {
  const fullName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const fitnessFocus = typeof req.body?.goal === 'string' ? req.body.goal.trim() : '';

  if (fullName.length < 2 || fullName.length > 80) {
    return res.status(400).json({ error: 'Please enter a name between 2 and 80 characters.' });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!Object.hasOwn(focusKeywords, fitnessFocus)) {
    return res.status(400).json({ error: 'Please select a valid fitness focus.' });
  }

  try {
    const coach = matchCoach(fitnessFocus);
    const userId = `USR-${randomUUID()}`;
    db.prepare(`
      INSERT INTO users (user_id, full_name, email, fitness_focus, account_status, assigned_coach_id)
      VALUES (?, ?, ?, ?, 'Lead', ?)
    `).run(userId, fullName, email, fitnessFocus, coach?.coachId || null);

    return res.status(201).json({
      user: { userId, fullName, email, fitnessFocus },
      match: coach ? { coachId: coach.coachId, fullName: coach.fullName, specialties: coach.specialties } : null,
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'That email already has an intake profile.' });
    }
    console.error('Could not save intake submission:', error);
    return res.status(500).json({ error: 'We couldn’t save your intake. Please try again.' });
  }
});

app.get('/api/waitlist', (req, res) => {
  if (!isAdminAuthorized(req)) {
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

app.get('/api/users', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  try {
    const users = db.prepare(`
      SELECT u.user_id AS userId, u.full_name AS fullName, u.email,
        u.fitness_focus AS fitnessFocus, u.account_status AS accountStatus,
        u.created_at AS createdAt, c.coach_id AS coachId, c.full_name AS coachName
      FROM users u
      LEFT JOIN coaches c ON c.coach_id = u.assigned_coach_id
      ORDER BY u.created_at DESC, u.user_id DESC
    `).all();
    return res.json({ users });
  } catch (error) {
    console.error('Could not read intake users:', error);
    return res.status(500).json({ error: 'We couldn’t load intake users.' });
  }
});

function parseUserInput(body, { requireCoachSelection = false } = {}) {
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fitnessFocus = typeof body?.fitnessFocus === 'string' ? body.fitnessFocus.trim() : '';
  const accountStatus = typeof body?.accountStatus === 'string' ? body.accountStatus.trim() : 'Lead';
  const coachId = body?.coachId;

  if (fullName.length < 2 || fullName.length > 80) {
    return { error: 'Enter a name between 2 and 80 characters.' };
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  if (!Object.hasOwn(focusKeywords, fitnessFocus)) {
    return { error: 'Select a valid fitness focus.' };
  }
  if (!['Lead', 'Active', 'Paused'].includes(accountStatus)) {
    return { error: 'Select a valid account status.' };
  }
  if (requireCoachSelection && typeof coachId !== 'string') {
    return { error: 'Select a trainer match or choose automatic matching.' };
  }

  let assignedCoachId = null;
  if (coachId === 'auto' || (coachId === undefined && !requireCoachSelection)) {
    assignedCoachId = matchCoach(fitnessFocus)?.coachId || null;
  } else if (typeof coachId === 'string' && coachId.length > 0 && coachId !== 'none') {
    const coach = db.prepare('SELECT coach_id FROM coaches WHERE coach_id = ?').get(coachId);
    if (!coach) return { error: 'The selected trainer does not exist.' };
    assignedCoachId = coach.coach_id;
  }

  return { fullName, email, fitnessFocus, accountStatus, assignedCoachId };
}

function getAdminUser(userId) {
  return db.prepare(`
    SELECT u.user_id AS userId, u.full_name AS fullName, u.email,
      u.fitness_focus AS fitnessFocus, u.account_status AS accountStatus,
      u.created_at AS createdAt, c.coach_id AS coachId, c.full_name AS coachName
    FROM users u
    LEFT JOIN coaches c ON c.coach_id = u.assigned_coach_id
    WHERE u.user_id = ?
  `).get(userId);
}

app.post('/api/users', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  const userInput = parseUserInput(req.body, { requireCoachSelection: true });
  if (userInput.error) return res.status(400).json({ error: userInput.error });

  try {
    const userId = `USR-${randomUUID()}`;
    db.prepare(`
      INSERT INTO users (user_id, full_name, email, fitness_focus, account_status, assigned_coach_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      userInput.fullName,
      userInput.email,
      userInput.fitnessFocus,
      userInput.accountStatus,
      userInput.assignedCoachId
    );
    return res.status(201).json({ user: getAdminUser(userId) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    console.error('Could not create admin user:', error);
    return res.status(500).json({ error: 'We couldn’t create the user.' });
  }
});

app.put('/api/users/:userId', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  const userInput = parseUserInput(req.body, { requireCoachSelection: true });
  if (userInput.error) return res.status(400).json({ error: userInput.error });

  try {
    const result = db.prepare(`
      UPDATE users
      SET full_name = ?, email = ?, fitness_focus = ?, account_status = ?, assigned_coach_id = ?
      WHERE user_id = ?
    `).run(
      userInput.fullName,
      userInput.email,
      userInput.fitnessFocus,
      userInput.accountStatus,
      userInput.assignedCoachId,
      req.params.userId
    );
    if (result.changes === 0) return res.status(404).json({ error: 'User not found.' });

    return res.json({ user: getAdminUser(req.params.userId) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    console.error('Could not update admin user:', error);
    return res.status(500).json({ error: 'We couldn’t update the user.' });
  }
});

app.delete('/api/users/:userId', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  try {
    const result = db.prepare('DELETE FROM users WHERE user_id = ?').run(req.params.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ message: 'User deleted.' });
  } catch (error) {
    console.error('Could not delete admin user:', error);
    return res.status(500).json({ error: 'We couldn’t delete the user.' });
  }
});

app.get('/api/coaches', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  try {
    const coaches = db.prepare(
      'SELECT coach_id AS coachId, full_name AS fullName, specialties, style, environment, image_url AS imageUrl, hourly_rate AS hourlyRate FROM coaches ORDER BY full_name COLLATE NOCASE'
    ).all();
    return res.json({ coaches });
  } catch (error) {
    console.error('Could not read coaches:', error);
    return res.status(500).json({ error: 'We couldn?t load the coaches.' });
  }
});

app.get('/api/trainers', (_req, res) => {
  try {
    const trainers = db.prepare(
      'SELECT coach_id AS coachId, full_name AS fullName, specialties, style, environment, image_url AS imageUrl, hourly_rate AS hourlyRate FROM coaches ORDER BY full_name COLLATE NOCASE'
    ).all();
    return res.json({ trainers });
  } catch (error) {
    console.error('Could not read public trainer roster:', error);
    return res.status(500).json({ error: 'We couldn?t load the trainers.' });
  }
});

app.post('/api/coaches', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const specialties = typeof req.body?.specialties === 'string' ? req.body.specialties.trim() : '';
  const style = typeof req.body?.style === 'string' ? req.body.style.trim() : '';
  const environment = typeof req.body?.environment === 'string' ? req.body.environment.trim() : '';
  const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
  const hourlyRate = req.body?.hourlyRate;

  if (fullName.length < 2 || fullName.length > 80) {
    return res.status(400).json({ error: 'Enter a trainer name between 2 and 80 characters.' });
  }
  if (!specialties || specialties.length > 100 || !style || style.length > 80 || !environment || environment.length > 80) {
    return res.status(400).json({ error: 'Enter a specialty, style, and environment within the allowed lengths.' });
  }
  if (imageUrl.length > 2048 || !isValidImageUrl(imageUrl)) {
    return res.status(400).json({ error: 'Enter a valid HTTP or HTTPS image URL (up to 2048 characters).' });
  }
  if (typeof hourlyRate !== 'number' || !Number.isFinite(hourlyRate) || hourlyRate < 0 || hourlyRate > 100000) {
    return res.status(400).json({ error: 'Enter an hourly rate from 0 to 100000.' });
  }

  try {
    const lastCoach = db.prepare(
      "SELECT MAX(CAST(SUBSTR(coach_id, 5) AS INTEGER)) AS number FROM coaches WHERE coach_id GLOB 'COA-[0-9]*'"
    ).get();
    const coachId = `COA-${String((lastCoach.number || 0) + 1).padStart(3, '0')}`;
    db.prepare(
      'INSERT INTO coaches (coach_id, full_name, specialties, style, environment, image_url, hourly_rate, calendly_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(coachId, fullName, specialties, style, environment, imageUrl, hourlyRate, '');
    return res.status(201).json({ coach: { coachId, fullName, specialties, style, environment, imageUrl, hourlyRate } });
  } catch (error) {
    console.error('Could not save coach:', error);
    return res.status(500).json({ error: 'We couldn?t save the trainer. Please try again.' });
  }
});

app.put('/api/coaches/:coachId', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const specialties = typeof req.body?.specialties === 'string' ? req.body.specialties.trim() : '';
  const style = typeof req.body?.style === 'string' ? req.body.style.trim() : '';
  const environment = typeof req.body?.environment === 'string' ? req.body.environment.trim() : '';
  const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
  const hourlyRate = req.body?.hourlyRate;

  if (fullName.length < 2 || fullName.length > 80) {
    return res.status(400).json({ error: 'Enter a trainer name between 2 and 80 characters.' });
  }
  if (!specialties || specialties.length > 100 || !style || style.length > 80 || !environment || environment.length > 80) {
    return res.status(400).json({ error: 'Enter a specialty, style, and environment within the allowed lengths.' });
  }
  if (imageUrl.length > 2048 || !isValidImageUrl(imageUrl)) {
    return res.status(400).json({ error: 'Enter a valid HTTP or HTTPS image URL (up to 2048 characters).' });
  }
  if (typeof hourlyRate !== 'number' || !Number.isFinite(hourlyRate) || hourlyRate < 0 || hourlyRate > 100000) {
    return res.status(400).json({ error: 'Enter an hourly rate from 0 to 100000.' });
  }

  try {
    const result = db.prepare(
      'UPDATE coaches SET full_name = ?, specialties = ?, style = ?, environment = ?, image_url = ?, hourly_rate = ? WHERE coach_id = ?'
    ).run(fullName, specialties, style, environment, imageUrl, hourlyRate, req.params.coachId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trainer not found.' });
    }
    return res.json({ coach: { coachId: req.params.coachId, fullName, specialties, style, environment, imageUrl, hourlyRate } });
  } catch (error) {
    console.error('Could not update coach:', error);
    return res.status(500).json({ error: 'We couldn?t update the trainer. Please try again.' });
  }
});

app.delete('/api/coaches/:coachId', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  try {
    const result = db.prepare('DELETE FROM coaches WHERE coach_id = ?').run(req.params.coachId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trainer not found.' });
    }
    return res.json({ message: 'Trainer deleted.' });
  } catch (error) {
    console.error('Could not delete coach:', error);
    return res.status(500).json({ error: 'We couldn?t delete the trainer. Please try again.' });
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

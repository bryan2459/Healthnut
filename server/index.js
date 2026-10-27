import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import nodemailer from 'nodemailer';

const scrypt = promisify(scryptCallback);
const setupTokenLifetimeMs = 24 * 60 * 60 * 1000;
// Email is only sent when EMAIL_DELIVERY=enabled; otherwise emails are recorded in the email_log table.
const emailDeliveryEnabled = process.env.EMAIL_DELIVERY === 'enabled';
const clientSessionLifetimeMs = 12 * 60 * 60 * 1000;
const bookingNotifyEmail = process.env.BOOKING_NOTIFY_EMAIL || 'mvs390@gmail.com';

const app = express();
const port = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(here, 'data');
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
    mobile_number TEXT NOT NULL DEFAULT '',
    fitness_focus TEXT NOT NULL,
    account_status TEXT DEFAULT 'Lead',
    password_hash TEXT,
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

  CREATE TABLE IF NOT EXISTS email_log (
    email_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    recipient TEXT NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS client_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookings (
    booking_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    coach_id TEXT NOT NULL,
    requested_datetime TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (coach_id) REFERENCES coaches(coach_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS account_setup_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );
`);

const userColumns = new Set(db.pragma('table_info(users)').map((column) => column.name));
if (!userColumns.has('password_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
}

if (!userColumns.has('must_change_password')) {
  db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
}
if (!userColumns.has('mobile_number')) {
  db.exec("ALTER TABLE users ADD COLUMN mobile_number TEXT NOT NULL DEFAULT ''");
}

const bookingColumns = new Set(db.pragma('table_info(bookings)').map((column) => column.name));
if (!bookingColumns.has('amount')) {
  db.exec('ALTER TABLE bookings ADD COLUMN amount REAL NOT NULL DEFAULT 0');
}

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

function isValidMobileNumber(value) {
  const digits = value.replace(/\D/g, '');
  return value.length <= 25 && /^\+?[0-9\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
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

// While no sending domain is verified, EMAIL_REDIRECT_TO sends every email to that address instead.
function applyEmailRedirect({ to, subject, text }) {
  const redirectTo = process.env.EMAIL_REDIRECT_TO;
  if (!redirectTo || to.toLowerCase() === redirectTo.toLowerCase()) return { to, subject, text };
  return {
    to: redirectTo,
    subject: `[for ${to}] ${subject}`,
    text: `Redirected: originally addressed to ${to}\n\n${text}`,
  };
}

function getMailSettings() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, PUBLIC_APP_URL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !EMAIL_FROM || !PUBLIC_APP_URL) return null;

  const port = Number(SMTP_PORT) || 587;
  let appUrl;
  try {
    appUrl = new URL(PUBLIC_APP_URL);
  } catch {
    throw new Error('PUBLIC_APP_URL must be a valid HTTPS URL.');
  }
  if (appUrl.protocol !== 'https:' && !(appUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(appUrl.hostname))) {
    throw new Error('PUBLIC_APP_URL must use HTTPS, except for localhost development.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number.');
  }

  return {
    appUrl: appUrl.origin,
    from: EMAIL_FROM,
    transport: nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: SMTP_SECURE === undefined ? port === 465 : SMTP_SECURE.toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    }),
  };
}

function hashSetupToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = (stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const derivedKey = await scrypt(password, salt, expected.length);
  return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected);
}

async function sendLoggedEmail(original) {
  const { userId } = original;
  const { to, subject, text } = applyEmailRedirect(original);
  let mailSettings = null;
  if (emailDeliveryEnabled) {
    try {
      mailSettings = getMailSettings();
    } catch (error) {
      console.error('Email configuration is invalid:', error);
    }
  }
  const from = mailSettings?.from || process.env.EMAIL_FROM || 'Forme <no-reply@forme.test>';
  const log = (status, errorMessage = null) => db.prepare(`
    INSERT INTO email_log (user_id, recipient, sender, subject, body_text, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, to, from, subject, text, status, errorMessage);

  if (!mailSettings) {
    if (emailDeliveryEnabled) log('failed', 'Email settings are not configured.');
    else log('not_sent_delivery_disabled');
    return false;
  }
  try {
    await mailSettings.transport.sendMail({ from, to, subject, text });
    log('sent');
    return true;
  } catch (error) {
    console.error('Could not send email:', error);
    log('failed', String(error.message || error).slice(0, 500));
    return false;
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

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

app.post('/api/intake', async (req, res) => {
  const fullName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const mobileNumber = typeof req.body?.mobileNumber === 'string' ? req.body.mobileNumber.trim() : '';
  const fitnessFocus = typeof req.body?.goal === 'string' ? req.body.goal.trim() : '';

  if (fullName.length < 2 || fullName.length > 80) {
    return res.status(400).json({ error: 'Please enter a name between 2 and 80 characters.' });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!isValidMobileNumber(mobileNumber)) {
    return res.status(400).json({ error: 'Please enter a valid mobile number with 7 to 15 digits.' });
  }
  if (!Object.hasOwn(focusKeywords, fitnessFocus)) {
    return res.status(400).json({ error: 'Please select a valid fitness focus.' });
  }

  let mailSettings = null;
  let appUrl;
  if (emailDeliveryEnabled) {
    try {
      mailSettings = getMailSettings();
    } catch (error) {
      console.error('Account setup email configuration is invalid:', error);
      return res.status(503).json({ error: 'We can’t send account setup emails right now. Please try again later.' });
    }
    if (!mailSettings) {
      return res.status(503).json({ error: 'Account setup email is not configured. Please try again later.' });
    }
    appUrl = mailSettings.appUrl;
  } else {
    try {
      appUrl = new URL(process.env.PUBLIC_APP_URL || 'http://localhost:5173').origin;
    } catch {
      appUrl = 'http://localhost:5173';
    }
  }

  const coach = matchCoach(fitnessFocus);
  const userId = `USR-${randomUUID()}`;
  const tempPassword = randomBytes(9).toString('base64url');
  try {
    const passwordHash = await hashPassword(tempPassword);
    db.prepare(`
      INSERT INTO users (user_id, full_name, email, mobile_number, fitness_focus, account_status, assigned_coach_id, password_hash, must_change_password)
      VALUES (?, ?, ?, ?, ?, 'Lead', ?, ?, 1)
    `).run(userId, fullName, email, mobileNumber, fitnessFocus, coach?.coachId || null, passwordHash);

    const loginUrl = new URL('/login', appUrl);
    const message = {
      from: mailSettings?.from || process.env.EMAIL_FROM || 'Forme <no-reply@forme.test>',
      ...applyEmailRedirect({ to: email, subject: 'Your Forme account and temporary password', text: `Hi ${fullName},\n\nThanks for finding your fit with Forme. Your account has been created.\n\nLog in here: ${loginUrl.href}\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nYou will be asked to choose a new password the first time you log in. Your account status is Lead until then.\n\nIf you didn’t request this,       you can ignore this email.` }),
    };
    const logEmail = (status, errorMessage = null) => db.prepare(`
      INSERT INTO email_log (user_id, recipient, sender, subject, body_text, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, message.to, message.from, message.subject, message.text, status, errorMessage);

    if (mailSettings) {
      try {
        await mailSettings.transport.sendMail(message);
        logEmail('sent');
      } catch (error) {
        logEmail('failed', String(error.message || error).slice(0, 500));
        db.prepare('DELETE FROM users WHERE user_id = ?').run(userId);
        throw error;
      }
    } else {
      logEmail('not_sent_delivery_disabled');
      console.log(`Email delivery disabled. Logged account email for ${email}. View it at GET /api/emails.`);
    }

    return res.status(201).json({
      user: { userId, fullName, email, mobileNumber, fitnessFocus },
      match: coach ? { coachId: coach.coachId, fullName: coach.fullName, specialties: coach.specialties } : null,
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'That email already has an intake profile.' });
    }
    console.error('Could not complete intake or send account setup email:', error);
    return res.status(500).json({ error: 'We couldn’t complete your intake. Please try again.' });
  }
});

app.post('/api/account/setup', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!token || token.length > 256) {
    return res.status(400).json({ error: 'This account setup link is invalid or has expired.' });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Choose a password between 12 and 128 characters.' });
  }

  try {
    const tokenHash = hashSetupToken(token);
    const setupToken = db.prepare(`
      SELECT user_id AS userId
      FROM account_setup_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `).get(tokenHash, Date.now());
    if (!setupToken) {
      return res.status(400).json({ error: 'This account setup link is invalid or has expired.' });
    }

    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scrypt(password, salt, 64);
    const passwordHash = `scrypt$${salt}$${derivedKey.toString('hex')}`;
    const setupAccount = db.transaction(() => {
      const claimedToken = db.prepare(`
        UPDATE account_setup_tokens SET used_at = ?
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
      `).run(Date.now(), tokenHash, Date.now());
      if (claimedToken.changes !== 1) return false;
      db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, account_status = CASE WHEN account_status = 'Lead' THEN 'Active' ELSE account_status END WHERE user_id = ?").run(passwordHash, setupToken.userId);
      return true;
    });
    if (!setupAccount()) {
      return res.status(400).json({ error: 'This account setup link is invalid or has expired.' });
    }
    return res.json({ message: 'Your password has been set. Your account is now Active.' });
  } catch (error) {
    console.error('Could not complete account setup:', error);
    return res.status(500).json({ error: 'We couldn’t set your password. Please try again.' });
  }
});

const loginAttempts = new Map();

function isLoginThrottled(key) {
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  loginAttempts.set(key, recent);
  return recent.length >= 10;
}

function loadClient(userId) {
  const user = db.prepare(`
    SELECT user_id AS userId, full_name AS fullName, email, mobile_number AS mobileNumber, fitness_focus AS fitnessFocus,
      account_status AS accountStatus, must_change_password AS mustChangePassword,
      assigned_coach_id AS coachId
    FROM users WHERE user_id = ?
  `).get(userId);
  if (!user) return null;
  return { ...user, mustChangePassword: Boolean(user.mustChangePassword) };
}

function requireClient(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const session = token && db.prepare(
    'SELECT user_id AS userId FROM client_sessions WHERE token_hash = ? AND expires_at > ?'
  ).get(hashSetupToken(token), Date.now());
  const client = session && loadClient(session.userId);
  if (!client) return res.status(401).json({ error: 'Please log in to continue.' });
  req.client = client;
  req.clientToken = token;
  return next();
}

app.post('/api/auth/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const throttleKey = `${req.ip}|${email}`;
  if (isLoginThrottled(throttleKey)) {
    return res.status(429).json({ error: 'Too many attempts. Please try again in a few minutes.' });
  }
  try {
    const row = email && password.length <= 128
      ? db.prepare('SELECT user_id AS userId, password_hash AS passwordHash FROM users WHERE email = ?').get(email)
      : null;
    const valid = row ? await verifyPassword(password, row.passwordHash) : false;
    if (!valid) {
      loginAttempts.get(throttleKey).push(Date.now());
      return res.status(401).json({ error: 'That email or password is not correct.' });
    }
    loginAttempts.delete(throttleKey);
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM client_sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO client_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(hashSetupToken(token), row.userId, Date.now() + clientSessionLifetimeMs);
    return res.json({ token, user: loadClient(row.userId) });
  } catch (error) {
    console.error('Could not log in:', error);
    return res.status(500).json({ error: 'We couldn’t log you in. Please try again.' });
  }
});

const passwordResetAttempts = new Map();

app.post('/api/auth/request-password-reset', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const throttleKey = `${req.ip}|${email}`;
  const now = Date.now();
  const recent = (passwordResetAttempts.get(throttleKey) || []).filter((time) => now - time < 15 * 60 * 1000);
  passwordResetAttempts.set(throttleKey, recent);
  if (recent.length >= 3) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a few minutes.' });
  }
  recent.push(now);

  try {
    const user = email
      ? db.prepare('SELECT user_id AS userId, full_name AS fullName FROM users WHERE email = ?').get(email)
      : null;
    if (user) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = hashSetupToken(token);
      db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
        .run(now, user.userId);
      db.prepare('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        .run(tokenHash, user.userId, now + 60 * 60 * 1000);
      const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
      const resetUrl = new URL('/login', appUrl);
      resetUrl.searchParams.set('reset', token);
      await sendLoggedEmail({
        userId: user.userId,
        to: email,
        subject: 'Reset your Forme password',
        text: `Hi ${user.fullName},\n\nWe received a request to reset your Forme password. Use this link within one hour:\n\n${resetUrl.href}\n\nIf you didn’t request a password reset, you can ignore this email.`,
      });
    }
    return res.json({ message: 'If an account exists for that email, we’ve sent a password reset link.' });
  } catch (error) {
    console.error('Could not request a password reset:', error);
    return res.status(500).json({ error: 'We couldn’t send a password reset link. Please try again.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!token || token.length > 256) {
    return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Choose a password between 12 and 128 characters.' });
  }

  try {
    const tokenHash = hashSetupToken(token);
    const resetToken = db.prepare(`
      SELECT user_id AS userId
      FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `).get(tokenHash, Date.now());
    if (!resetToken) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
    }

    const passwordHash = await hashPassword(password);
    const resetPassword = db.transaction(() => {
      const resetTime = Date.now();
      const claimedToken = db.prepare(`
        UPDATE password_reset_tokens SET used_at = ?
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
      `).run(resetTime, tokenHash, resetTime);
      if (claimedToken.changes !== 1) return false;
      db.prepare(`
        UPDATE users SET password_hash = ?, must_change_password = 0,
          account_status = CASE WHEN account_status = 'Lead' THEN 'Active' ELSE account_status END
        WHERE user_id = ?
      `).run(passwordHash, resetToken.userId);
      db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
        .run(resetTime, resetToken.userId);
      db.prepare('DELETE FROM client_sessions WHERE user_id = ?').run(resetToken.userId);
      return true;
    });
    if (!resetPassword()) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
    }
    return res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (error) {
    console.error('Could not reset password:', error);
    return res.status(500).json({ error: 'We couldn’t reset your password. Please try again.' });
  }
});

app.post('/api/auth/logout', requireClient, (req, res) => {
  db.prepare('DELETE FROM client_sessions WHERE token_hash = ?').run(hashSetupToken(req.clientToken));
  return res.json({ message: 'Logged out.' });
});

app.post('/api/auth/change-password', requireClient, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (newPassword.length < 12 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Choose a password between 12 and 128 characters.' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'Your new password must be different from your temporary password.' });
  }
  try {
    const row = db.prepare('SELECT password_hash AS passwordHash FROM users WHERE user_id = ?').get(req.client.userId);
    if (currentPassword.length > 128 || !(await verifyPassword(currentPassword, row?.passwordHash))) {
      return res.status(400).json({ error: 'Your current password is not correct.' });
    }
    const passwordHash = await hashPassword(newPassword);
    db.prepare(`
      UPDATE users
      SET password_hash = ?, must_change_password = 0,
        account_status = CASE WHEN must_change_password = 1 THEN 'Active' ELSE account_status END
      WHERE user_id = ?
    `).run(passwordHash, req.client.userId);
    return res.json({ user: loadClient(req.client.userId) });
  } catch (error) {
    console.error('Could not change password:', error);
    return res.status(500).json({ error: 'We couldn’t change your password. Please try again.' });
  }
});

function listClientBookings(userId) {
  return db.prepare(`
    SELECT b.booking_id AS bookingId, b.coach_id AS coachId, c.full_name AS coachName,
      b.requested_datetime AS requestedDatetime, b.status, b.created_at AS createdAt
    FROM bookings b JOIN coaches c ON c.coach_id = b.coach_id
    WHERE b.user_id = ? ORDER BY b.requested_datetime DESC
  `).all(userId);
}

app.get('/api/me', requireClient, (req, res) => {
  const trainers = db.prepare(
    'SELECT coach_id AS coachId, full_name AS fullName, specialties, style, environment FROM coaches WHERE is_active = 1 ORDER BY full_name COLLATE NOCASE'
  ).all();
  return res.json({ user: req.client, trainers, bookings: listClientBookings(req.client.userId) });
});

app.put('/api/me/coach', requireClient, (req, res) => {
  const coachId = typeof req.body?.coachId === 'string' ? req.body.coachId : '';
  const coach = db.prepare('SELECT coach_id AS coachId FROM coaches WHERE coach_id = ? AND is_active = 1').get(coachId);
  if (!coach) return res.status(400).json({ error: 'Please choose an available trainer.' });
  db.prepare('UPDATE users SET assigned_coach_id = ? WHERE user_id = ?').run(coach.coachId, req.client.userId);
  return res.json({ user: loadClient(req.client.userId) });
});

app.post('/api/me/bookings', requireClient, async (req, res) => {
  if (req.client.mustChangePassword) {
    return res.status(403).json({ error: 'Please change your temporary password first.' });
  }
  const coachId = typeof req.body?.coachId === 'string' ? req.body.coachId : '';
  const requested = new Date(typeof req.body?.datetime === 'string' ? req.body.datetime : '');
  const coach = db.prepare(
    'SELECT coach_id AS coachId, full_name AS fullName FROM coaches WHERE coach_id = ? AND is_active = 1'
  ).get(coachId);
  if (!coach) return res.status(400).json({ error: 'Please choose an available trainer.' });
  if (Number.isNaN(requested.getTime()) || requested.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'Please choose a date and time in the future.' });
  }
  if (requested.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'Please choose a date within the next year.' });
  }

  const bookingId = `BKG-${randomUUID()}`;
  const requestedDatetime = requested.toISOString();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO bookings (booking_id, user_id, coach_id, requested_datetime, status)
      VALUES (?, ?, ?, ?, 'Pending')
    `).run(bookingId, req.client.userId, coach.coachId, requestedDatetime);
    db.prepare('UPDATE users SET assigned_coach_id = ? WHERE user_id = ?').run(coach.coachId, req.client.userId);
  })();

  const emailSent = await sendLoggedEmail({
    userId: req.client.userId,
    to: bookingNotifyEmail,
    subject: `New session booking request from ${req.client.fullName}`,
    text: `A client has requested a session.\n\nClient: ${req.client.fullName} (${req.client.email})\nMobile: ${req.client.mobileNumber}\nFitness focus: ${req.client.fitnessFocus}\nTrainer: ${coach.fullName}\nRequested time: ${requestedDatetime} (UTC)\nStatus: Pending\nBooking ID: ${bookingId}`,
  });
  return res.status(201).json({
    emailSent,
    user: loadClient(req.client.userId),
    bookings: listClientBookings(req.client.userId),
  });
});

function buildPortalData() {
  const clients = db.prepare(`
    SELECT u.user_id AS userId, u.full_name AS fullName, u.email,
      u.mobile_number AS mobileNumber, u.fitness_focus AS fitnessFocus,
      u.account_status AS accountStatus, c.full_name AS coachName,
      COALESCE(SUM(CASE WHEN b.status = 'Complete' THEN b.amount END), 0) AS spentSoFar,
      COALESCE(SUM(CASE WHEN b.status = 'Billed' THEN b.amount END), 0) AS outstanding,
      COALESCE(SUM(CASE WHEN b.status = 'Confirmed' THEN b.amount END), 0) AS upcomingConfirmed
    FROM users u
    LEFT JOIN coaches c ON c.coach_id = u.assigned_coach_id
    LEFT JOIN bookings b ON b.user_id = u.user_id
    WHERE u.account_status = 'Active'
    GROUP BY u.user_id
    ORDER BY u.full_name COLLATE NOCASE
  `).all();
  const bookings = db.prepare(`
    SELECT b.booking_id AS bookingId, b.user_id AS userId, u.full_name AS clientName, u.email AS clientEmail,
      u.mobile_number AS clientMobileNumber,
      b.coach_id AS coachId, c.full_name AS coachName, b.requested_datetime AS requestedDatetime,
      b.status, b.amount, c.hourly_rate AS hourlyRate
    FROM bookings b
    JOIN users u ON u.user_id = b.user_id
    JOIN coaches c ON c.coach_id = b.coach_id
    ORDER BY b.requested_datetime DESC
  `).all();
  return { clients, bookings };
}

app.get('/api/portal', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }
  try {
    return res.json(buildPortalData());
  } catch (error) {
    console.error('Could not load trainer portal:', error);
    return res.status(500).json({ error: 'We couldn’t load the trainer portal.' });
  }
});

app.put('/api/portal/bookings/:bookingId', async (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }
  const status = req.body?.status;
  // Each status can only be reached from one previous status.
  const allowedFrom = { Confirmed: 'Pending', Rejected: 'Pending', Billed: 'Confirmed', Complete: 'Billed' };
  if (!Object.hasOwn(allowedFrom, status)) {
    return res.status(400).json({ error: 'Status must be Confirmed, Rejected, Billed or Complete.' });
  }
  try {
    const booking = db.prepare(`
      SELECT b.booking_id AS bookingId, b.user_id AS userId, b.requested_datetime AS requestedDatetime,
        b.amount AS amount, u.full_name AS clientName, u.email AS clientEmail,
        c.full_name AS coachName, c.hourly_rate AS hourlyRate
      FROM bookings b
      JOIN users u ON u.user_id = b.user_id
      JOIN coaches c ON c.coach_id = b.coach_id
      WHERE b.booking_id = ?
    `).get(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    if (['Billed', 'Complete'].includes(status) && new Date(booking.requestedDatetime).getTime() > Date.now()) {
      return res.status(400).json({ error: 'This session hasn’t taken place yet. You can bill or mark it paid after its date and time has passed.' });
    }

    const amount = status === 'Confirmed' ? booking.hourlyRate : status === 'Rejected' ? 0 : booking.amount;
    const updated = db.prepare(
      'UPDATE bookings SET status = ?, amount = ? WHERE booking_id = ? AND status = ?'
    ).run(status, amount, booking.bookingId, allowedFrom[status]);
    if (updated.changes !== 1) {
      return res.status(409).json({ error: `Only ${allowedFrom[status].toLowerCase()} bookings can be set to ${status.toLowerCase()}.` });
    }

    const when = new Date(booking.requestedDatetime).toUTCString();
    const price = `$${Number(amount).toFixed(2)}`;
    const emails = {
      Confirmed: {
        subject: 'Your Forme session is confirmed',
        text: `Hi ${booking.clientName},\n\nGood news! Your session with ${booking.coachName} on ${when} has been confirmed.\n\nSession price: ${price}\n\nSee you there,\nThe Forme team`,
      },
      Rejected: {
        subject: 'Your Forme session request was declined',
        text: `Hi ${booking.clientName},\n\nUnfortunately ${booking.coachName} can’t take your session request for ${when}. Please log in and choose another date, time or trainer.\n\nThe Forme team`,
      },
      Billed: {
        subject: `Your Forme session invoice: ${price}`,
        text: `Hi ${booking.clientName},\n\nThanks for training with ${booking.coachName} on ${when}.\n\nAmount due: ${price}\nBooking ID: ${booking.bookingId}\n\nPlease arrange payment. We’ll email you again once we receive it.\n\nThe Forme team`,
      },
      Complete: {
        subject: 'Payment received. Thank you!',
        text: `Hi ${booking.clientName},\n\nWe’ve received your payment of ${price} for your session with ${booking.coachName} on ${when}. Thank you!\n\nThe Forme team`,
      },
    };
    const emailSent = await sendLoggedEmail({
      userId: booking.userId,
      to: booking.clientEmail,
      ...emails[status],
    });
    return res.json({ emailSent, ...buildPortalData() });
  } catch (error) {
    console.error('Could not update booking:', error);
    return res.status(500).json({ error: 'We couldn’t update the booking. Please try again.' });
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

app.get('/api/emails', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }
  try {
    const emails = db.prepare(`
      SELECT email_id AS emailId, user_id AS userId, recipient, sender, subject,
        body_text AS bodyText, status, error, created_at AS createdAt
      FROM email_log ORDER BY email_id DESC LIMIT 200
    `).all();
    return res.json({ emails });
  } catch (error) {
    console.error('Could not read email log:', error);
    return res.status(500).json({ error: 'We couldn’t load the email log.' });
  }
});

app.get('/api/users', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'A valid admin token is required.' });
  }

  try {
    const users = db.prepare(`
      SELECT u.user_id AS userId, u.full_name AS fullName, u.email,
        u.mobile_number AS mobileNumber,
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
  const mobileNumber = typeof body?.mobileNumber === 'string' ? body.mobileNumber.trim() : '';
  const fitnessFocus = typeof body?.fitnessFocus === 'string' ? body.fitnessFocus.trim() : '';
  const accountStatus = typeof body?.accountStatus === 'string' ? body.accountStatus.trim() : 'Lead';
  const coachId = body?.coachId;

  if (fullName.length < 2 || fullName.length > 80) {
    return { error: 'Enter a name between 2 and 80 characters.' };
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  if (!isValidMobileNumber(mobileNumber)) {
    return { error: 'Enter a valid mobile number with 7 to 15 digits.' };
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

  return { fullName, email, mobileNumber, fitnessFocus, accountStatus, assignedCoachId };
}

function getAdminUser(userId) {
  return db.prepare(`
    SELECT u.user_id AS userId, u.full_name AS fullName, u.email,
      u.mobile_number AS mobileNumber,
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
      INSERT INTO users (user_id, full_name, email, mobile_number, fitness_focus, account_status, assigned_coach_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      userInput.fullName,
      userInput.email,
      userInput.mobileNumber,
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
      SET full_name = ?, email = ?, mobile_number = ?, fitness_focus = ?, account_status = ?, assigned_coach_id = ?
      WHERE user_id = ?
    `).run(
      userInput.fullName,
      userInput.email,
      userInput.mobileNumber,
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

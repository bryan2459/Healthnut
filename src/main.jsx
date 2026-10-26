import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, Dumbbell,
  Heart, Menu, MoveUpRight, Pencil, Sparkles, Trash2, X,
} from 'lucide-react';
import './styles.css';

const fallbackCoachImages = {
  marcus: '/images/trainer-marcus.jpg',
  elena: '/images/trainer-elena.jpg',
  kai: '/images/trainer-kai.jpg',
};

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <a className="brand" href="#" aria-label="Forme home"><span className="brand-mark"><Dumbbell size={19} /></span>forme<span className="brand-dot">.</span></a>
      <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button>
      <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'}>
        <a href="#trainers" onClick={() => setMenuOpen(false)}>Find a trainer</a>
        <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
        <a href="#stories" onClick={() => setMenuOpen(false)}>Our approach</a>
        <a href="/login" className="nav-login">Log in</a>
      </nav>
      <a className="header-cta" href="#waitlist">Get early access <ArrowUpRight size={15} /></a>
    </header>
  );
}

function TrainerCard({ trainer, index }) {
  const color = ['lavender', 'peach', 'sage', 'butter'][index % 4];
  return (
    <article className={`trainer-card card-${color}`} style={{ '--card-index': index }}>
      <div className="trainer-photo-wrap">
        <CoachPicture key={`${trainer.fullName}-${trainer.imageUrl}`} imageUrl={trainer.imageUrl} name={trainer.fullName} variant="trainer" />
        <span className="trainer-location">{trainer.environment}</span>
        <span className="session-label">{trainer.style || 'Personal trainer'}</span>
      </div>
      <div className="trainer-info">
        <div className="trainer-heading">
          <div><h3>{trainer.fullName}</h3><p>{trainer.specialties}</p></div>
        </div>
        <div className="expertise-list">{trainer.environment && <span>{trainer.environment}</span>}</div>
        <p className="trainer-gains">Personalized {trainer.specialties.toLowerCase()} coaching, with a {trainer.style.toLowerCase() || 'personal'} approach.</p>
        <div className="trainer-footer"><span className="rate"><strong>${Number(trainer.hourlyRate).toFixed(0)}</strong> <span>/ hour</span></span><a href="#waitlist" className="profile-link">Meet {trainer.fullName.split(' ')[0]} <ArrowRight size={15} /></a></div>
      </div>
    </article>
  );
}

function CoachPicture({ imageUrl, name, variant = 'roster' }) {
  const [failedUrl, setFailedUrl] = useState('');
  const initials = name.trim().slice(0, 1).toUpperCase();
  const fallbackImageUrl = fallbackCoachImages[name.trim().toLowerCase()] || '';
  const displayImageUrl = imageUrl && failedUrl !== imageUrl
    ? imageUrl
    : fallbackImageUrl && failedUrl !== fallbackImageUrl
      ? fallbackImageUrl
      : '';
  const preview = variant === 'preview';
  const trainer = variant === 'trainer';
  const placeholderClass = trainer
    ? 'trainer-photo-placeholder'
    : preview
      ? 'coach-preview-placeholder'
      : 'coach-roster-placeholder';
  const imageClass = trainer
    ? 'trainer-photo'
    : preview
      ? 'coach-preview-image'
      : 'coach-roster-image';

  return (
    <>
      {(trainer || !displayImageUrl) && <span className={placeholderClass} aria-hidden="true">{initials}</span>}
      {displayImageUrl && <img
        className={imageClass}
        src={displayImageUrl}
        alt={`${name}${trainer ? ', personal trainer' : ''}`}
        loading={preview ? undefined : 'lazy'}
        onError={() => setFailedUrl(displayImageUrl)}
      />}
      {preview && imageUrl && failedUrl === imageUrl && <p className="coach-image-error" role="status">Couldn’t load this URL; showing a stock photo when available.</p>}
    </>
  );
}

function emailDateFromTimestamp(value) {
  return new Date(`${value.replace(' ', 'T')}Z`);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function WaitlistForm() {
  const [form, setForm] = useState({ name: '', email: '', goal: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: '' });
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Something went wrong.');
      setStatus({ type: 'success', message: 'You?re on the list! We?ll be in touch soon.' });
      setForm({ name: '', email: '', goal: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not connect. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="waitlist-form" onSubmit={submit}>
      <label htmlFor="name">Your name</label>
      <input id="name" name="name" autoComplete="name" placeholder="Alex Morgan" required minLength="2" maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <label htmlFor="goal">What are you working toward? <span>Optional</span></label>
      <textarea id="goal" name="goal" placeholder="Feeling stronger, training for a race..." maxLength="500" rows="3" value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} />
      <button type="submit" className="button button-dark form-submit" disabled={submitting}>{submitting ? 'Joining...' : 'Join the waitlist'} <ArrowRight size={17} /></button>
      {status.message && <p className={`form-message ${status.type}`} role="status">{status.type === 'success' && <Check size={16} />}{status.message}</p>}
      <p className="privacy-note">No spam, ever. Just good things for your fitness journey.</p>
    </form>
  );
}

function TrainerPortal({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const headers = { Authorization: ['Bearer', token].join(' '), 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch('/api/portal', { headers })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load the portal.');
        setData(result);
      })
      .catch((requestError) => setError(requestError.message || 'Could not connect to the server.'));
  }, []);

  async function decide(booking, status) {
    setUpdatingId(booking.bookingId);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/portal/bookings/${encodeURIComponent(booking.bookingId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update the booking.');
      setData({ clients: result.clients, bookings: result.bookings });
      setMessage(`Booking marked ${status.toLowerCase()}. An email to ${booking.clientEmail} was recorded in the Email log.`);
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the server.');
    } finally {
      setUpdatingId('');
    }
  }

  const money = (value) => `$${Number(value).toFixed(2)}`;
  const hasPassed = (booking) => new Date(booking.requestedDatetime).getTime() <= Date.now();
  const when = (value) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const pending = (data?.bookings || []).filter((booking) => booking.status === 'Pending');
  const billing = (data?.bookings || []).filter((booking) => ['Confirmed', 'Billed'].includes(booking.status))
    .sort((left, right) => left.requestedDatetime.localeCompare(right.requestedDatetime));
  const bookingsFor = (userId) => (data?.bookings || []).filter((booking) => booking.userId === userId);

  return (
    <>
      {error && <p className="form-message error" role="alert">{error}</p>}
      {message && <p className="admin-section-description" role="status">{message}</p>}
      {!data && !error && <p className="empty-state">Loading...</p>}
      {data && <>
        <section className="entries">
          <div className="entries-heading"><h2>Pending session requests</h2><span>{pending.length} pending</span></div>
          {pending.length === 0 ? <p className="empty-state">No pending requests.</p> : <div className="table-scroll"><table><thead><tr><th>Client</th><th>Trainer</th><th>Requested time</th><th>Price</th><th>Actions</th></tr></thead><tbody>{pending.map((booking) => <tr key={booking.bookingId}><td>{booking.clientName}<br /><small>{booking.clientEmail}<br />{booking.clientMobileNumber}</small></td><td>{booking.coachName}</td><td>{when(booking.requestedDatetime)}</td><td>{money(booking.hourlyRate)}</td><td><div className="coach-actions"><button type="button" onClick={() => decide(booking, 'Confirmed')} disabled={Boolean(updatingId)}><Check size={14} />Confirm</button><button type="button" className="delete-coach" onClick={() => decide(booking, 'Rejected')} disabled={Boolean(updatingId)}><X size={14} />Reject</button></div></td></tr>)}</tbody></table></div>}
        </section>
        <section className="entries">
          <div className="entries-heading"><h2>Sessions to bill</h2><span>{billing.length} open</span></div>
          <p className="admin-section-description">After a session is completed, click Bill to email the client the cost. When payment arrives, click Mark paid to complete it.</p>
          {billing.length === 0 ? <p className="empty-state">No confirmed or billed sessions.</p> : <div className="table-scroll"><table><thead><tr><th>Client</th><th>Trainer</th><th>Session time</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{billing.map((booking) => <tr key={booking.bookingId}><td>{booking.clientName}<br /><small>{booking.clientEmail}<br />{booking.clientMobileNumber}</small></td><td>{booking.coachName}</td><td>{when(booking.requestedDatetime)}</td><td>{money(booking.amount)}</td><td>{booking.status}</td><td><div className="coach-actions">{booking.status === 'Confirmed'
            ? <button type="button" onClick={() => decide(booking, 'Billed')} disabled={Boolean(updatingId) || !hasPassed(booking)} title={hasPassed(booking) ? undefined : 'Available after the session date and time has passed'}><Check size={14} />Bill client</button>
            : <button type="button" onClick={() => decide(booking, 'Complete')} disabled={Boolean(updatingId) || !hasPassed(booking)} title={hasPassed(booking) ? undefined : 'Available after the session date and time has passed'}><Check size={14} />Mark paid</button>}</div></td></tr>)}</tbody></table></div>}
        </section>
        <section className="entries">
          <div className="entries-heading"><h2>Active clients</h2><span>{data.clients.length} active</span></div>
          {data.clients.length === 0 ? <p className="empty-state">No active clients yet. Clients become active after their first login.</p> : <div className="table-scroll"><table><thead><tr><th>Client</th><th>Goal</th><th>Trainer</th><th>Spent so far (paid)</th><th>Outstanding (billed)</th><th>Upcoming confirmed</th><th>Booking history</th></tr></thead><tbody>{data.clients.map((client) => <tr key={client.userId}><td>{client.fullName}<br /><small>{client.email}<br />{client.mobileNumber}</small></td><td>{client.fitnessFocus}</td><td>{client.coachName || 'None'}</td><td>{money(client.spentSoFar)}</td><td>{money(client.outstanding)}</td><td>{money(client.upcomingConfirmed)}</td><td><details><summary>{bookingsFor(client.userId).length} sessions</summary>{bookingsFor(client.userId).length === 0 ? <p>No sessions yet.</p> : <ul>{bookingsFor(client.userId).map((booking) => <li key={booking.bookingId}>{when(booking.requestedDatetime)} · {booking.coachName} · {booking.status}{['Confirmed', 'Billed', 'Complete'].includes(booking.status) ? ` · ${money(booking.amount)}` : ''}</li>)}</ul>}</details></td></tr>)}</tbody></table></div>}
        </section>
      </>}
    </>
  );
}

function AdminDashboard() {
  const [view, setView] = useState('dashboard');
  const [token, setToken] = useState('');
  const [entries, setEntries] = useState(null);
  const [users, setUsers] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [emails, setEmails] = useState([]);
  const [emailDateFilter, setEmailDateFilter] = useState('all');
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingCoachId, setDeletingCoachId] = useState('');
  const [editingCoachId, setEditingCoachId] = useState('');
  const [coachForm, setCoachForm] = useState({ fullName: '', specialties: '', style: '', environment: '', imageUrl: '', hourlyRate: '' });
  const [editingUserId, setEditingUserId] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    fitnessFocus: fitnessGoals[0].value,
    accountStatus: 'Lead',
    coachId: 'auto',
  });

  const today = new Date();
  const todayKey = localDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  const sevenDayStart = new Date(today);
  sevenDayStart.setHours(0, 0, 0, 0);
  sevenDayStart.setDate(sevenDayStart.getDate() - 6);
  const sevenDayStartKey = localDateKey(sevenDayStart);
  const emailGroups = [];
  const emailGroupMap = new Map();
  for (const email of emails) {
    const createdAt = emailDateFromTimestamp(email.createdAt);
    const dateKey = localDateKey(createdAt);
    if (emailDateFilter === 'today' && dateKey !== todayKey) continue;
    if (emailDateFilter === '7days' && dateKey < sevenDayStartKey) continue;

    let group = emailGroupMap.get(dateKey);
    if (!group) {
      const label = dateKey === todayKey
        ? 'Today'
        : dateKey === yesterdayKey
          ? 'Yesterday'
          : createdAt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      group = { dateKey, label, emails: [] };
      emailGroupMap.set(dateKey, group);
      emailGroups.push(group);
    }
    group.emails.push(email);
  }
  emailGroups.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  for (const group of emailGroups) {
    group.emails.sort((a, b) => emailDateFromTimestamp(b.createdAt) - emailDateFromTimestamp(a.createdAt));
  }

  async function loadDashboard(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [waitlistResponse, coachesResponse, usersResponse] = await Promise.all([
        fetch('/api/waitlist', { headers }),
        fetch('/api/coaches', { headers }),
        fetch('/api/users', { headers }),
      ]);
      const [waitlistResult, coachesResult, usersResult] = await Promise.all([
        waitlistResponse.json(),
        coachesResponse.json(),
        usersResponse.json(),
      ]);
      if (!waitlistResponse.ok) throw new Error(waitlistResult.error || 'Could not load entries.');
      if (!coachesResponse.ok) throw new Error(coachesResult.error || 'Could not load trainers.');
      if (!usersResponse.ok) throw new Error(usersResult.error || 'Could not load intake users.');
      setEntries(waitlistResult.entries);
      setCoaches(coachesResult.coaches);
      setUsers(usersResult.users);
      const emailsResponse = await fetch('/api/emails', { headers });
      setEmails(emailsResponse.ok ? (await emailsResponse.json()).emails : []);
      setAuthenticated(true);
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the server.');
      setEntries(null);
      setUsers([]);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  async function saveCoach(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const isEditing = Boolean(editingCoachId);
    try {
      const response = await fetch(isEditing ? `/api/coaches/${encodeURIComponent(editingCoachId)}` : '/api/coaches', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...coachForm, hourlyRate: Number(coachForm.hourlyRate) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save trainer.');
      setCoaches((current) => (isEditing
        ? current.map((coach) => coach.coachId === editingCoachId ? result.coach : coach)
        : [...current, result.coach]).sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setCoachForm({ fullName: '', specialties: '', style: '', environment: '', imageUrl: '', hourlyRate: '' });
      setEditingCoachId('');
      setSuccess(`${result.coach.fullName} was ${isEditing ? 'updated' : 'added'} ${isEditing ? 'in' : 'to'} the trainer roster.`);
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the server.');
    } finally {
      setSaving(false);
    }
  }

  function editCoach(coach) {
    setEditingCoachId(coach.coachId);
    setCoachForm({
      fullName: coach.fullName,
      specialties: coach.specialties,
      style: coach.style,
      environment: coach.environment,
      imageUrl: coach.imageUrl || '',
      hourlyRate: String(coach.hourlyRate ?? ''),
    });
    setError('');
    setSuccess('');
    document.getElementById('coach-name')?.focus();
  }

  function cancelCoachEdit() {
    setEditingCoachId('');
    setCoachForm({ fullName: '', specialties: '', style: '', environment: '', imageUrl: '', hourlyRate: '' });
  }

  async function deleteCoach(coach) {
    if (!window.confirm(`Delete ${coach.fullName} from the trainer roster?`)) return;
    setDeletingCoachId(coach.coachId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/coaches/${encodeURIComponent(coach.coachId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete trainer.');
      setCoaches((current) => current.filter((item) => item.coachId !== coach.coachId));
      setUsers((current) => current.map((user) => user.coachId === coach.coachId
        ? { ...user, coachId: null, coachName: null }
        : user));
      if (editingCoachId === coach.coachId) cancelCoachEdit();
      setSuccess(`${coach.fullName} was deleted from the trainer roster.`);
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the server.');
    } finally {
      setDeletingCoachId('');
    }
  }

  function resetUserForm() {
    setEditingUserId('');
    setShowUserForm(false);
    setUserForm({
      fullName: '',
      email: '',
      mobileNumber: '',
      fitnessFocus: fitnessGoals[0].value,
      accountStatus: 'Lead',
      coachId: 'auto',
    });
  }

  function editUser(user) {
    setEditingUserId(user.userId);
    setShowUserForm(true);
    setUserForm({
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber || '',
      fitnessFocus: user.fitnessFocus,
      accountStatus: user.accountStatus || 'Lead',
      coachId: user.coachId || '',
    });
    setError('');
    setSuccess('');
    document.getElementById('user-name')?.focus();
  }

  async function saveUser(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const isEditing = Boolean(editingUserId);
    try {
      const response = await fetch(isEditing
        ? `/api/users/${encodeURIComponent(editingUserId)}`
        : '/api/users', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { Authorization: ['Bearer', token].join(' '), 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save user.');
      setUsers((current) => (isEditing
        ? current.map((user) => user.userId === editingUserId ? result.user : user)
        : [result.user, ...current]));
      resetUserForm();
      setSuccess(`${result.user.fullName} was ${isEditing ? 'updated' : 'added'} ${isEditing ? 'in' : 'to'} the users list.`);
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the server.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete ${user.fullName} from the users list?`)) return;
    setDeletingUserId(user.userId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.userId)}`, {
        method: 'DELETE',
        headers: { Authorization: ['Bearer', token].join(' ') },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete user.');
      setUsers((current) => current.filter((item) => item.userId !== user.userId));
      if (editingUserId === user.userId) resetUserForm();
      setSuccess(`${user.fullName} was deleted from the users list.`);
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the server.');
    } finally {
      setDeletingUserId('');
    }
  }

  return (
    <main className="admin-page">
      <a className="brand" href="/"><span className="brand-mark"><Dumbbell size={19} /></span>forme<span className="brand-dot">.</span></a>
      <section className="admin-panel">
        <span className="eyebrow">FORME ? ADMIN</span>
        <h1>Admin dashboard</h1>
        {!authenticated && <p>Enter your admin password to manage trainers and view waitlist signups.</p>}
        {!authenticated && <form className="admin-form" onSubmit={loadDashboard}>
          <label htmlFor="admin-token">Admin password</label>
          <input id="admin-token" type="password" autoComplete="current-password" required value={token} onChange={(event) => setToken(event.target.value)} placeholder="Your admin password" />
          <button className="button button-dark" disabled={loading}>{loading ? 'Checking...' : 'Open admin'} <ArrowRight size={16} /></button>
        </form>}
        {error && <p className="form-message error" role="alert">{error}</p>}
        {authenticated && <nav className="admin-nav" aria-label="Admin sections">
          <button type="button" className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
          <button type="button" className={view === 'portal' ? 'active' : ''} onClick={() => setView('portal')}>Trainer Management Portal</button>
        </nav>}
        {authenticated && view === 'portal' && <TrainerPortal token={token} />}
        {authenticated && view === 'dashboard' && <>
          <section className="entries">
            <div className="entries-heading"><h2>{editingCoachId ? 'Update trainer' : 'Add a trainer'}</h2></div>
            <p className="admin-section-description">{editingCoachId ? 'Update this trainer’s roster details.' : 'Add a coach to your roster with their specialty, coaching style, and training environment.'}</p>
            <form className="admin-form trainer-admin-form" onSubmit={saveCoach}>
              <label htmlFor="coach-name">Trainer name</label>
              <input id="coach-name" required minLength="2" maxLength="80" placeholder="Marcus" value={coachForm.fullName} onChange={(event) => setCoachForm({ ...coachForm, fullName: event.target.value })} />
              <label htmlFor="coach-specialty">Specialty</label>
              <input id="coach-specialty" required maxLength="100" placeholder="Strength" value={coachForm.specialties} onChange={(event) => setCoachForm({ ...coachForm, specialties: event.target.value })} />
              <label htmlFor="coach-style">Coaching style</label>
              <input id="coach-style" required maxLength="80" placeholder="Data-Driven" value={coachForm.style} onChange={(event) => setCoachForm({ ...coachForm, style: event.target.value })} />
              <label htmlFor="coach-environment">Training environment</label>
              <input id="coach-environment" required maxLength="80" placeholder="Gym" value={coachForm.environment} onChange={(event) => setCoachForm({ ...coachForm, environment: event.target.value })} />
              <label htmlFor="coach-rate">Rate per hour (USD)</label>
              <input id="coach-rate" type="number" required min="0" max="100000" step="0.01" placeholder="85" value={coachForm.hourlyRate} onChange={(event) => setCoachForm({ ...coachForm, hourlyRate: event.target.value })} />
              <label htmlFor="coach-image">Coach picture URL <span>Optional · direct link to a publicly accessible image</span></label>
              <input id="coach-image" type="url" maxLength="2048" placeholder="https://example.com/coach-photo.jpg" value={coachForm.imageUrl} onChange={(event) => setCoachForm({ ...coachForm, imageUrl: event.target.value })} />
              {coachForm.imageUrl && <div className="coach-image-preview"><CoachPicture key={`${coachForm.fullName}-${coachForm.imageUrl}`} imageUrl={coachForm.imageUrl} name={coachForm.fullName || 'Coach'} variant="preview" /></div>}
              <div className="trainer-form-actions">
                <button className="button button-dark" disabled={saving}>{saving ? 'Saving...' : editingCoachId ? 'Save changes' : 'Add trainer'} <ArrowRight size={16} /></button>
                {editingCoachId && <button className="button button-outline" type="button" onClick={cancelCoachEdit} disabled={saving}>Cancel</button>}
              </div>
            </form>
            {success && <p className="form-message success" role="status"><Check size={16} />{success}</p>}
          </section>
          <div className="entries">
            <div className="entries-heading"><h2>Trainer roster</h2><span>{coaches.length} total</span></div>
            {coaches.length === 0 ? <p className="empty-state">No trainers added yet.</p> : <div className="table-scroll"><table><thead><tr><th>Picture</th><th>Name</th><th>Specialty</th><th>Rate / hour</th><th>Style</th><th>Environment</th><th>Actions</th></tr></thead><tbody>{coaches.map((coach) => <tr key={coach.coachId}><td><CoachPicture key={`${coach.fullName}-${coach.imageUrl}`} imageUrl={coach.imageUrl} name={coach.fullName} /></td><td>{coach.fullName}</td><td>{coach.specialties}</td><td>${Number(coach.hourlyRate).toFixed(2)}</td><td>{coach.style}</td><td>{coach.environment}</td><td><div className="coach-actions"><button type="button" onClick={() => editCoach(coach)} aria-label={`Edit ${coach.fullName}`} disabled={Boolean(deletingCoachId)}><Pencil size={14} />Edit</button><button type="button" className="delete-coach" onClick={() => deleteCoach(coach)} aria-label={`Delete ${coach.fullName}`} disabled={Boolean(deletingCoachId)}><Trash2 size={14} />{deletingCoachId === coach.coachId ? 'Deleting...' : 'Delete'}</button></div></td></tr>)}</tbody></table></div>}
          </div>
          <div className="entries"><div className="entries-heading"><h2>Waitlist responses</h2><span>{entries.length} total</span></div>{entries.length === 0 ? <p className="empty-state">No signups yet.</p> : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Goal</th><th>Joined</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{entry.name}</td><td>{entry.email}</td><td>{entry.goal || '?'}</td><td>{new Date(`${entry.createdAt.replace(' ', 'T')}Z`).toLocaleString()}</td></tr>)}</tbody></table></div>}</div>
          <section className="entries">
            <div className="entries-heading">
              <h2>Users</h2>
              <div className="user-list-actions">
                <span>{users.length} total</span>
                <button className="button button-dark user-add-button" type="button" onClick={() => { resetUserForm(); setShowUserForm(true); setError(''); setSuccess(''); }}>Add user <ArrowRight size={15} /></button>
              </div>
            </div>
            <p className="admin-section-description">Intake users, their fitness focus, and their matched trainer.</p>
            {showUserForm && (
              <form className="admin-form user-admin-form" onSubmit={saveUser}>
                <label htmlFor="user-name">Name</label>
                <input id="user-name" required minLength="2" maxLength="80" placeholder="Alex Morgan" value={userForm.fullName} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} />
                <label htmlFor="user-email">Email</label>
                <input id="user-email" type="email" required maxLength="254" placeholder="alex@example.com" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
                <label htmlFor="user-mobile">Mobile number</label>
                <input id="user-mobile" type="tel" autoComplete="tel" required maxLength="25" placeholder="+1 555 123 4567" value={userForm.mobileNumber} onChange={(event) => setUserForm({ ...userForm, mobileNumber: event.target.value })} />
                <label htmlFor="user-focus">Fitness focus</label>
                <select id="user-focus" required value={userForm.fitnessFocus} onChange={(event) => setUserForm({ ...userForm, fitnessFocus: event.target.value })}>
                  {fitnessGoals.map((focus) => <option key={focus.value} value={focus.value}>{focus.label}</option>)}
                </select>
                <label htmlFor="user-status">Status</label>
                <select id="user-status" value={userForm.accountStatus} onChange={(event) => setUserForm({ ...userForm, accountStatus: event.target.value })}>
                  <option value="Lead">Lead</option>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                </select>
                <label htmlFor="user-coach">Matched trainer</label>
                <select id="user-coach" value={userForm.coachId} onChange={(event) => setUserForm({ ...userForm, coachId: event.target.value })}>
                  <option value="auto">Automatically match by focus</option>
                  <option value="">No trainer</option>
                  {coaches.map((coach) => <option key={coach.coachId} value={coach.coachId}>{coach.fullName} — {coach.specialties}</option>)}
                </select>
                <div className="trainer-form-actions">
                  <button className="button button-dark" type="submit" disabled={saving}>{saving ? 'Saving...' : editingUserId ? 'Save changes' : 'Add user'} <ArrowRight size={16} /></button>
                  <button className="button button-outline" type="button" onClick={resetUserForm} disabled={saving}>Cancel</button>
                </div>
              </form>
            )}
            {users.length === 0 ? <p className="empty-state">No intake users yet.</p> :             <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Fitness focus</th><th>Matched trainer</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.userId}><td>{user.fullName}</td><td>{user.email}</td><td>{user.mobileNumber}</td><td>{user.fitnessFocus}</td><td>{user.coachName || 'No match available'}</td><td>{user.accountStatus || 'Lead'}</td><td>{new Date(`${user.createdAt.replace(' ', 'T')}Z`).toLocaleString()}</td><td><div className="coach-actions"><button type="button" onClick={() => editUser(user)} aria-label={`Edit ${user.fullName}`} disabled={Boolean(deletingUserId)}><Pencil size={14} />Edit</button><button type="button" className="delete-coach" onClick={() => deleteUser(user)} aria-label={`Delete ${user.fullName}`} disabled={Boolean(deletingUserId)}><Trash2 size={14} />{deletingUserId === user.userId ? 'Deleting...' : 'Delete'}</button></div></td></tr>)}</tbody></table></div>}
          </section>
          <div className="entries email-log">
            <div className="entries-heading"><h2>Email log</h2><span>{emails.length} total</span></div>
            {emails.length === 0 ? <p className="empty-state">No emails recorded yet.</p> : <>
              <div className="email-log-filters" role="group" aria-label="Filter email log by date">
                <button type="button" className={emailDateFilter === 'today' ? 'active' : ''} aria-pressed={emailDateFilter === 'today'} onClick={() => setEmailDateFilter('today')}>Today</button>
                <button type="button" className={emailDateFilter === '7days' ? 'active' : ''} aria-pressed={emailDateFilter === '7days'} onClick={() => setEmailDateFilter('7days')}>Last 7 days</button>
                <button type="button" className={emailDateFilter === 'all' ? 'active' : ''} aria-pressed={emailDateFilter === 'all'} onClick={() => setEmailDateFilter('all')}>All</button>
              </div>
              {emailGroups.length === 0 ? <p className="empty-state">No emails in this date range.</p> : emailGroups.map((group) => (
                <details className="email-date-group" key={group.dateKey} open={group.dateKey === todayKey}>
                  <summary><span>{group.label}</span><span className="email-date-count">{group.emails.length} {group.emails.length === 1 ? 'email' : 'emails'}</span></summary>
                  <div className="table-scroll"><table><thead><tr><th>Recipient</th><th>Subject</th><th>Status</th><th>Setup email text</th><th>Created</th></tr></thead><tbody>{group.emails.map((email) => <tr key={email.emailId}><td>{email.recipient}</td><td>{email.subject}</td><td>{email.status}{email.error ? ` (${email.error})` : ''}</td><td><details><summary>View</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{email.bodyText}</pre></details></td><td>{emailDateFromTimestamp(email.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>
                </details>
              ))}
            </>}
          </div>
          <button className="admin-logout" onClick={() => { setAuthenticated(false); setToken(''); setEntries(null); setUsers([]); setCoaches([]); setEmails([]); }}>Lock admin dashboard</button>
        </>}
      </section>
    </main>
  );
}

function LandingPage() {
  const [trainers, setTrainers] = useState([]);
  const [loadingTrainers, setLoadingTrainers] = useState(true);
  const [trainerError, setTrainerError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    fetch('/api/trainers')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load trainers.');
        return result.trainers;
      })
      .then((result) => {
        if (isCurrent) setTrainers(result);
      })
      .catch((error) => {
        if (isCurrent) setTrainerError(error.message || 'Could not connect to the server.');
      })
      .finally(() => {
        if (isCurrent) setLoadingTrainers(false);
      });
    return () => { isCurrent = false; };
  }, []);

  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="kicker-line" />A better kind of personal training</div>
            <h1>Find your<br /><span>kind of strong.</span></h1>
            <p className="hero-description">The right trainer changes everything. Meet thoughtful coaches who see you, get your goals, and make getting stronger feel like your thing.</p>
            <div className="hero-actions"><a href="/intake" className="button button-dark">Find your trainer <ArrowRight size={17} /></a><a href="#how-it-works" className="text-link">See how it works <ArrowDown size={15} /></a></div>
            <div className="social-proof"><div className="avatar-stack"><span className="avatar av-one">J</span><span className="avatar av-two">M</span><span className="avatar av-three">A</span><span className="avatar av-four">+</span></div><div><div className="proof-stars">?????</div><span>Good people. Real progress.</span></div></div>
          </div>
          <div className="hero-visual">
            <div className="hero-image"><img src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1100&q=90" alt="A trainer encouraging a client through a workout" /></div>
            <div className="hero-note note-top"><span className="note-icon"><Sparkles size={16} /></span><span><strong>Progress, your way</strong><small>Built around your life</small></span></div>
            <div className="hero-note note-bottom"><span className="note-pulse"><span /></span><span><strong>Good fit, first time</strong><small>Meet your coach before you commit</small></span></div>
            <div className="hero-image-caption">Move better. Feel more like you.</div>
          </div>
          <div className="hero-index">01 <span /> 04</div>
        </section>

        <section className="trust-strip"><span>TRAINING FOR REAL LIFE</span><div><span>Strength</span><i /> <span>Mobility</span><i /> <span>Mindset</span><i /> <span>Momentum</span></div><span className="trust-end">YOUR PACE. YOUR PLACE.</span></section>

        <section className="trainers-section section-pad" id="trainers">
          <div className="section-heading">
            <div><span className="eyebrow">GOOD PEOPLE, GREAT COACHES</span><h2>A coach who gets <em>you.</em></h2><p>Different goals, different bodies, different lives. There?s no one-size-fits-all here.</p></div>
            <a className="text-link see-all" href="#waitlist">See all trainers <MoveUpRight size={16} /></a>
          </div>
          {loadingTrainers && <p className="trainer-roster-status">Loading trainers...</p>}
          {trainerError && <p className="trainer-roster-status error" role="alert">{trainerError}</p>}
          {!loadingTrainers && !trainerError && trainers.length === 0 && <p className="trainer-roster-status">No trainers are listed right now. Join the waitlist and we’ll help you find a match.</p>}
          {!loadingTrainers && trainers.length > 0 && <div className="trainer-grid">{trainers.map((trainer, index) => <TrainerCard key={trainer.coachId} trainer={trainer} index={index} />)}</div>}
          <div className="trainer-footnote"><span><span className="online-dot" /> Coaches accepting new clients</span><a href="/intake">Want us to find your match? <ArrowRight size={15} /></a></div>
        </section>

        <section className="approach-section" id="how-it-works">
          <div className="approach-image"><img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1100&q=85" alt="A person stretching in a bright studio" loading="lazy" /><div className="image-stamp"><span>STRONG</span><span>LOOKS LIKE</span><span>YOU <Heart size={15} fill="currentColor" /></span></div></div>
          <div className="approach-copy" id="stories"><span className="eyebrow">A LITTLE LESS PRESSURE. A LOT MORE YOU.</span><h2>Fitness should fit<br />into <em>your</em> life.</h2><p>Forget before-and-after. We?re here for the everyday wins: feeling good in your body, finding a rhythm you enjoy, and having someone in your corner when life gets busy.</p><div className="approach-points"><div><span>01</span><div><strong>Tell us what matters</strong><p>Big goal or just want to feel better?we start with you.</p></div></div><div><span>02</span><div><strong>Meet your kind of coach</strong><p>Browse real people with the skills and energy you need.</p></div></div><div><span>03</span><div><strong>Make progress that lasts</strong><p>Build a routine that works in your real, wonderfully messy life.</p></div></div></div><a href="#waitlist" className="text-link">Let?s find your fit <ArrowRight size={15} /></a></div>
        </section>

        <section className="waitlist-section" id="waitlist">
          <div className="waitlist-orb orb-one" /><div className="waitlist-orb orb-two" />
          <div className="waitlist-copy"><span className="eyebrow light-eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h2>Ready to feel<br />more <em>you?</em></h2><p>We?re welcoming new members soon. Get on the list and we?ll help you find a trainer who feels like a good fit from day one.</p><div className="waitlist-perk"><span><Check size={15} /></span>Early access, no pressure, all good energy.</div></div>
          <div className="waitlist-card"><div className="form-card-heading"><span className="form-icon"><Dumbbell size={18} /></span><div><h3>Let?s get you started.</h3><p>Join the Forme early access list</p></div></div><WaitlistForm /></div>
          <div className="waitlist-footer"><span>FORME IS FOR EVERY BODY.</span><Sparkles size={16} /><span>YOU BELONG HERE.</span></div>
        </section>
      </main>
      <footer className="site-footer"><a className="brand" href="#"><span className="brand-mark"><Dumbbell size={18} /></span>forme<span className="brand-dot">.</span></a><span>Made for the way you move.</span><a href="/admin" className="admin-link">Admin</a><span>? 2025 Forme</span></footer>
    </>
  );
}

const fitnessGoals = [
  { value: 'Build strength', icon: '💪', label: 'Build Strength' },
  { value: 'Cardio & endurance', icon: '🏃‍♂️', label: 'Cardio & Endurance' },
  { value: 'Flexibility & mobility', icon: '🧘', label: 'Flexibility / Mobility' },
  { value: 'Energy & health', icon: '🔋', label: 'Energy & Health' },
];

function IntakePage() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(() => sessionStorage.getItem('forme-intake-goal') || '');
  const [form, setForm] = useState({ name: '', email: '', mobileNumber: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [matchedCoach, setMatchedCoach] = useState(null);

  function saveAndExit() {
    if (goal) sessionStorage.setItem('forme-intake-goal', goal);
    window.location.assign('/');
  }

  function goBack() {
    setStep(0);
    setStatus({ type: '', message: '' });
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: '' });
    try {
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, goal }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Something went wrong.');
      sessionStorage.removeItem('forme-intake-goal');
      setMatchedCoach(result.match);
      setStep(2);
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not connect. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  const progress = step === 0 ? 40 : step === 1 ? 70 : 100;

  return (
    <main className="intake-page">
      <div className="intake-shell">
        <header className="intake-header">
          <a className="brand intake-brand" href="/" aria-label="Forme home">forme<span className="brand-dot">.</span></a>
          <button className="intake-save" type="button" onClick={saveAndExit}>Save &amp; Exit</button>
        </header>

        <div className="intake-progress" role="progressbar" aria-label="Intake progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>

        {step === 0 && (
          <section className="intake-content" aria-labelledby="intake-title">
            <span className="intake-step-label">A LITTLE ABOUT YOU</span>
            <h1 id="intake-title">What is your primary fitness focus right now?</h1>
            <p className="intake-instruction">Select one</p>
            <div className="goal-options" role="radiogroup" aria-labelledby="intake-title">
              {fitnessGoals.map((option) => (
                <button
                  className={`goal-option${goal === option.value ? ' selected' : ''}`}
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={goal === option.value}
                  onClick={() => setGoal(option.value)}
                >
                  <span className="goal-icon" aria-hidden="true">{option.icon}</span>
                  <span>{option.label}</span>
                  <span className="goal-radio" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="intake-content intake-contact" aria-labelledby="intake-title">
            <span className="intake-step-label">YOUR NEXT STEP</span>
            <h1 id="intake-title">Let’s find your fit.</h1>
            <p className="intake-instruction">Where can we reach you with your trainer matches?</p>
            <form className="intake-form" onSubmit={submit}>
              <label htmlFor="intake-name">Your name</label>
              <input id="intake-name" name="name" autoComplete="name" placeholder="Alex Morgan" required minLength="2" maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <label htmlFor="intake-email">Email address</label>
              <input id="intake-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <label htmlFor="intake-mobile">Mobile number</label>
              <input id="intake-mobile" name="mobileNumber" type="tel" autoComplete="tel" placeholder="+1 555 123 4567" required maxLength="25" value={form.mobileNumber} onChange={(event) => setForm({ ...form, mobileNumber: event.target.value })} />
              <p className="intake-instruction">Required so your trainer can contact you about sessions and payments. Include your country code for international numbers.</p>
              {status.message && <p className="intake-error" role="alert">{status.message}</p>}
              <button className="intake-next" type="submit" disabled={submitting}>{submitting ? 'Sending...' : 'Finish'} <ArrowRight size={18} /></button>
            </form>
          </section>
        )}

        {step === 2 && (
          <section className="intake-content intake-complete" aria-live="polite">
            <span className="intake-complete-icon"><Check size={25} /></span>
            <span className="intake-step-label">YOU’RE ALL SET</span>
            <h1>Thanks for sharing what matters to you.</h1>
            <p className="intake-instruction">{matchedCoach ? `Your recommended trainer is ${matchedCoach.fullName} (${matchedCoach.specialties}). ` : ''}            We’ve prepared an email with your temporary password and a login link. Your account status is Lead until you log in and set a new password.</p>
                        <a className="intake-next" href="/login">Log in <ArrowRight size={18} /></a>
          </section>
        )}

        {step < 2 && (
          <nav className="intake-navigation" aria-label="Form navigation">
            {step === 0
              ? <a className="intake-back" href="/">← <span>Back</span></a>
              : <button className="intake-back" type="button" onClick={goBack}>← <span>Back</span></button>}
            {step === 0 && <button className="intake-next" type="button" disabled={!goal} onClick={() => setStep(1)}>Next <ArrowRight size={18} /></button>}
          </nav>
        )}
        <p className="intake-footnote">Your journey, your pace. We’re glad you’re here.</p>
      </div>
    </main>
  );
}

function SetupAccountPage() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: 'Your passwords do not match.' });
      return;
    }
    setSubmitting(true);
    setStatus({ type: '', message: '' });
    try {
      const response = await fetch('/api/account/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not set your password.');
      setComplete(true);
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not connect. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="intake-page">
      <div className="intake-shell">
        <header className="intake-header">
          <a className="brand intake-brand" href="/" aria-label="Forme home">forme<span className="brand-dot">.</span></a>
        </header>
        <section className="intake-content setup-content" aria-labelledby="setup-title">
          {complete ? (
            <div className="intake-complete" aria-live="polite">
              <span className="intake-complete-icon"><Check size={25} /></span>
              <span className="intake-step-label">PASSWORD SET</span>
              <h1 id="setup-title">Your account is ready.</h1>
              <p className="intake-instruction">Your account status is Active. <a href="/login">Log in</a> to book a session.</p>
            </div>
          ) : (
            <>
              <span className="intake-step-label">WELCOME TO FORME</span>
              <h1 id="setup-title">Set your password.</h1>
              <p className="intake-instruction">Choose a password to finish setting up your account. Use at least 12 characters.</p>
              {token ? (
                <form className="intake-form" onSubmit={submit}>
                  <label htmlFor="setup-password">New password</label>
                  <input id="setup-password" type="password" autoComplete="new-password" minLength="12" maxLength="128" required value={password} onChange={(event) => setPassword(event.target.value)} />
                  <label htmlFor="setup-confirm-password">Confirm password</label>
                  <input id="setup-confirm-password" type="password" autoComplete="new-password" minLength="12" maxLength="128" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  {status.message && <p className="intake-error" role="alert">{status.message}</p>}
                  <button className="intake-next" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Set password'} <ArrowRight size={18} /></button>
                </form>
              ) : (
                <p className="intake-error" role="alert">This account setup link is invalid or has expired. Please complete the trainer form again to request a new link.</p>
              )}
            </>
          )}
        </section>
        <p className="intake-footnote">Your journey, your pace. We’re glad you’re here.</p>
      </div>
    </main>
  );
}

function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ClientPortal() {
  const [token, setToken] = useState(() => sessionStorage.getItem('forme-client-token') || '');
  const [data, setData] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [resetPasswordForm, setResetPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [authView, setAuthView] = useState(() => new URLSearchParams(window.location.search).has('reset') ? 'reset' : 'login');
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '');
  const [bookingTime, setBookingTime] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [busy, setBusy] = useState(false);

  function signOut(message = '') {
    sessionStorage.removeItem('forme-client-token');
    setToken('');
    setData(null);
    setStatus(message ? { type: 'error', message } : { type: '', message: '' });
  }

  async function api(path, options = {}, authToken = token) {
    const response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && authToken) signOut('Your session has ended. Please log in again.');
      throw new Error(result.error || 'Something went wrong.');
    }
    return result;
  }

  useEffect(() => {
    if (!token) return;
    api('/api/me').then(setData).catch(() => {});
  }, [token]);

  async function run(action) {
    setBusy(true);
    setStatus({ type: '', message: '' });
    try {
      await action();
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not connect. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const login = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(loginForm) }, '');
      sessionStorage.setItem('forme-client-token', result.token);
      setLoginForm({ email: '', password: '' });
      setToken(result.token);
    });
  };

  const requestPasswordReset = (event) => {
    event.preventDefault();
    run(async () => {
      await api('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email: loginForm.email }),
      }, '');
      setStatus({ type: 'success', message: 'If an account exists for that email, we’ve sent a password reset link.' });
      setAuthView('sent');
    });
  };

  const resetPassword = (event) => {
    event.preventDefault();
    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setStatus({ type: 'error', message: 'Your new passwords do not match.' });
      return;
    }
    run(async () => {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, password: resetPasswordForm.password }),
      }, '');
      window.history.replaceState({}, '', window.location.pathname);
      setStatus({ type: 'success', message: 'Your password has been reset. You can now log in.' });
      setAuthView('reset-success');
    });
  };

  const changePassword = (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatus({ type: 'error', message: 'Your new passwords do not match.' });
      return;
    }
    run(async () => {
      const result = await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setData((current) => ({ ...current, user: result.user }));
      setStatus({ type: 'success', message: 'Password updated. Your account is now Active.' });
    });
  };

  const changeTrainer = (coachId) => run(async () => {
    const result = await api('/api/me/coach', { method: 'PUT', body: JSON.stringify({ coachId }) });
    setData((current) => ({ ...current, user: result.user }));
    setStatus({ type: 'success', message: 'Your trainer has been updated.' });
  });

  const bookSession = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await api('/api/me/bookings', {
        method: 'POST',
        body: JSON.stringify({ coachId: data.user.coachId, datetime: new Date(bookingTime).toISOString() }),
      });
      setData((current) => ({ ...current, user: result.user, bookings: result.bookings }));
      setBookingTime('');
      setStatus({ type: 'success', message: 'Booking requested. Its status is Pending until your trainer confirms.' });
    });
  };

  const user = data?.user;
  const now = Date.now();
  const bookings = data?.bookings || [];
  const pastBookings = bookings.filter((booking) => new Date(booking.requestedDatetime).getTime() < now);
  const upcomingBookings = bookings.filter((booking) => new Date(booking.requestedDatetime).getTime() >= now).reverse();
  const bookingTable = (rows) => (
    <div className="table-scroll"><table><thead><tr><th>Trainer</th><th>Date &amp; time</th><th>Status</th></tr></thead><tbody>
      {rows.map((booking) => <tr key={booking.bookingId}><td>{booking.coachName}</td><td>{formatDateTime(booking.requestedDatetime)}</td><td>{booking.status}</td></tr>)}
    </tbody></table></div>
  );

  return (
    <main className="intake-page">
      <div className="intake-shell">
        <header className="intake-header">
          <a className="brand intake-brand" href="/" aria-label="Forme home">forme<span className="brand-dot">.</span></a>
          {token && <button className="intake-save" type="button" onClick={() => api('/api/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => signOut())}>Log out</button>}
        </header>

        {!token && authView === 'login' && (
          <section className="intake-content setup-content" aria-labelledby="login-title">
            <span className="intake-step-label">WELCOME BACK</span>
            <h1 id="login-title">Log in to Forme.</h1>
            <p className="intake-instruction">Use the email you signed up with and the password from your welcome email.</p>
            <form className="intake-form" onSubmit={login}>
              <label htmlFor="login-email">Email address</label>
              <input id="login-email" type="email" autoComplete="email" required maxLength="254" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} />
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" autoComplete="current-password" required maxLength="128" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} />
              <button className="password-reset-link" type="button" onClick={() => { setStatus({ type: '', message: '' }); setAuthView('request'); }}>Forgot password?</button>
              {status.message && <p className="intake-error" role="alert">{status.message}</p>}
              <button className="intake-next" type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'} <ArrowRight size={18} /></button>
            </form>
          </section>
        )}

        {!token && authView === 'request' && (
          <section className="intake-content setup-content" aria-labelledby="reset-request-title">
            <span className="intake-step-label">ACCOUNT RECOVERY</span>
            <h1 id="reset-request-title">Reset your password.</h1>
            <p className="intake-instruction">Enter the email address for your account and we’ll send you a reset link.</p>
            <form className="intake-form" onSubmit={requestPasswordReset}>
              <label htmlFor="reset-email">Email address</label>
              <input id="reset-email" type="email" autoComplete="email" required maxLength="254" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} />
              {status.message && <p className="intake-error" role="alert">{status.message}</p>}
              <button className="intake-next" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'} <ArrowRight size={18} /></button>
              <button className="password-reset-link" type="button" onClick={() => { setStatus({ type: '', message: '' }); setAuthView('login'); }}>Back to log in</button>
            </form>
          </section>
        )}

        {!token && authView === 'sent' && (
          <section className="intake-content setup-content" aria-labelledby="reset-sent-title">
            <span className="intake-step-label">ACCOUNT RECOVERY</span>
            <h1 id="reset-sent-title">Check your email.</h1>
            <p className="intake-instruction" role="status">{status.message}</p>
            <button className="password-reset-link" type="button" onClick={() => { setStatus({ type: '', message: '' }); setAuthView('login'); }}>Back to log in</button>
          </section>
        )}

        {!token && authView === 'reset' && (
          <section className="intake-content setup-content" aria-labelledby="reset-password-title">
            <span className="intake-step-label">ACCOUNT RECOVERY</span>
            <h1 id="reset-password-title">Choose a new password.</h1>
            <p className="intake-instruction">Choose a password between 12 and 128 characters.</p>
            <form className="intake-form" onSubmit={resetPassword}>
              <label htmlFor="reset-new-password">New password</label>
              <input id="reset-new-password" type="password" autoComplete="new-password" required minLength="12" maxLength="128" value={resetPasswordForm.password} onChange={(event) => setResetPasswordForm({ ...resetPasswordForm, password: event.target.value })} />
              <label htmlFor="reset-confirm-password">Confirm new password</label>
              <input id="reset-confirm-password" type="password" autoComplete="new-password" required minLength="12" maxLength="128" value={resetPasswordForm.confirmPassword} onChange={(event) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: event.target.value })} />
              {status.message && <p className="intake-error" role="alert">{status.message}</p>}
              <button className="intake-next" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Reset password'} <ArrowRight size={18} /></button>
            </form>
          </section>
        )}

        {!token && authView === 'reset-success' && (
          <section className="intake-content setup-content" aria-labelledby="reset-success-title">
            <span className="intake-step-label">ACCOUNT RECOVERY</span>
            <h1 id="reset-success-title">Password updated.</h1>
            <p className="intake-instruction" role="status">{status.message}</p>
            <button className="password-reset-link" type="button" onClick={() => { setStatus({ type: '', message: '' }); setAuthView('login'); }}>Back to log in</button>
          </section>
        )}

        {token && !user && <p className="intake-instruction">Loading your dashboard...</p>}

        {user?.mustChangePassword && (
          <section className="intake-content setup-content" aria-labelledby="change-title">
            <span className="intake-step-label">FIRST LOGIN</span>
            <h1 id="change-title">Choose a new password.</h1>
            <p className="intake-instruction">Replace your temporary password (at least 12 characters) to activate your account.</p>
            <form className="intake-form" onSubmit={changePassword}>
              <label htmlFor="current-password">Temporary password</label>
              <input id="current-password" type="password" autoComplete="current-password" required maxLength="128" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
              <label htmlFor="new-password">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" required minLength="12" maxLength="128" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} />
              <label htmlFor="confirm-password">Confirm new password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" required minLength="12" maxLength="128" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} />
              {status.message && <p className={status.type === 'error' ? 'intake-error' : 'intake-instruction'} role="alert">{status.message}</p>}
              <button className="intake-next" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Update password'} <ArrowRight size={18} /></button>
            </form>
          </section>
        )}

        {user && !user.mustChangePassword && (
          <section className="intake-content client-dashboard" aria-labelledby="dashboard-title">
            <span className="intake-step-label">CLIENT DASHBOARD &amp; GOAL TRACKING</span>
            <h1 id="dashboard-title">Hi {user.fullName.split(' ')[0]}.</h1>
            <p className="intake-instruction">Account status: <strong>{user.accountStatus}</strong> · Your goal: <strong>{user.fitnessFocus}</strong> · Mobile: <strong>{user.mobileNumber}</strong></p>
            {status.message && <p className={status.type === 'error' ? 'intake-error' : 'intake-instruction'} role="alert">{status.message}</p>}

            <form className="intake-form" onSubmit={bookSession}>
              <h2>Book a session</h2>
              <label htmlFor="trainer-select">Trainer</label>
              <select id="trainer-select" value={user.coachId || ''} disabled={busy} onChange={(event) => changeTrainer(event.target.value)}>
                {!user.coachId && <option value="">Choose a trainer</option>}
                {data.trainers.map((trainer) => <option key={trainer.coachId} value={trainer.coachId}>{trainer.fullName} — {trainer.specialties}</option>)}
              </select>
              <label htmlFor="booking-time">Date and time</label>
              <input id="booking-time" type="datetime-local" required value={bookingTime} onChange={(event) => setBookingTime(event.target.value)} />
              <button className="intake-next" type="submit" disabled={busy || !user.coachId}>{busy ? 'Sending...' : 'Request booking'} <ArrowRight size={18} /></button>
            </form>

            <h2>Upcoming &amp; pending bookings</h2>
            {upcomingBookings.length === 0 ? <p className="empty-state">No upcoming bookings.</p> : bookingTable(upcomingBookings)}
            <h2>Past bookings</h2>
            {pastBookings.length === 0 ? <p className="empty-state">No past bookings yet.</p> : bookingTable(pastBookings)}
          </section>
        )}
      </div>
    </main>
  );
}

function App() {
  if (window.location.pathname === '/login' || window.location.pathname === '/dashboard') return <ClientPortal />;
  if (window.location.pathname === '/admin') return <AdminDashboard />;
  if (window.location.pathname === '/intake') return <IntakePage />;
  if (window.location.pathname === '/setup-account') return <SetupAccountPage />;
  return <LandingPage />;
}

createRoot(document.getElementById('root')).render(<App />);

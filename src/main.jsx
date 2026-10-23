import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, Dumbbell,
  Heart, Menu, MoveUpRight, Pencil, Sparkles, Trash2, X,
} from 'lucide-react';
import './styles.css';

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
      </nav>
      <a className="header-cta" href="#waitlist">Get early access <ArrowUpRight size={15} /></a>
    </header>
  );
}

function TrainerCard({ trainer, index }) {
  const initials = trainer.fullName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('');
  const color = ['lavender', 'peach', 'sage', 'butter'][index % 4];
  return (
    <article className={`trainer-card card-${color}`} style={{ '--card-index': index }}>
      <div className="trainer-photo-wrap">
        <div className="trainer-photo-placeholder" aria-hidden="true">{initials}</div>
        {trainer.imageUrl && <img className="trainer-photo" src={trainer.imageUrl} alt={`${trainer.fullName}, personal trainer`} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
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

function AdminDashboard() {
  const [token, setToken] = useState('');
  const [entries, setEntries] = useState(null);
  const [users, setUsers] = useState([]);
  const [coaches, setCoaches] = useState([]);
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
    fitnessFocus: fitnessGoals[0].value,
    accountStatus: 'Lead',
    coachId: 'auto',
  });

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
        {authenticated && <>
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
              <label htmlFor="coach-image">Coach picture URL <span>Optional · use an https:// image link</span></label>
              <input id="coach-image" type="url" maxLength="2048" placeholder="https://example.com/coach-photo.jpg" value={coachForm.imageUrl} onChange={(event) => setCoachForm({ ...coachForm, imageUrl: event.target.value })} />
              {coachForm.imageUrl && <div className="coach-image-preview"><img src={coachForm.imageUrl} alt="Coach picture preview" onError={(event) => { event.currentTarget.hidden = true; }} onLoad={(event) => { event.currentTarget.hidden = false; }} /></div>}
              <div className="trainer-form-actions">
                <button className="button button-dark" disabled={saving}>{saving ? 'Saving...' : editingCoachId ? 'Save changes' : 'Add trainer'} <ArrowRight size={16} /></button>
                {editingCoachId && <button className="button button-outline" type="button" onClick={cancelCoachEdit} disabled={saving}>Cancel</button>}
              </div>
            </form>
            {success && <p className="form-message success" role="status"><Check size={16} />{success}</p>}
          </section>
          <div className="entries">
            <div className="entries-heading"><h2>Trainer roster</h2><span>{coaches.length} total</span></div>
            {coaches.length === 0 ? <p className="empty-state">No trainers added yet.</p> : <div className="table-scroll"><table><thead><tr><th>Picture</th><th>Name</th><th>Specialty</th><th>Rate / hour</th><th>Style</th><th>Environment</th><th>Actions</th></tr></thead><tbody>{coaches.map((coach) => <tr key={coach.coachId}><td>{coach.imageUrl ? <img className="coach-roster-image" src={coach.imageUrl} alt={`${coach.fullName}`} loading="lazy" /> : <span className="coach-roster-placeholder">{coach.fullName.slice(0, 1)}</span>}</td><td>{coach.fullName}</td><td>{coach.specialties}</td><td>${Number(coach.hourlyRate).toFixed(2)}</td><td>{coach.style}</td><td>{coach.environment}</td><td><div className="coach-actions"><button type="button" onClick={() => editCoach(coach)} aria-label={`Edit ${coach.fullName}`} disabled={Boolean(deletingCoachId)}><Pencil size={14} />Edit</button><button type="button" className="delete-coach" onClick={() => deleteCoach(coach)} aria-label={`Delete ${coach.fullName}`} disabled={Boolean(deletingCoachId)}><Trash2 size={14} />{deletingCoachId === coach.coachId ? 'Deleting...' : 'Delete'}</button></div></td></tr>)}</tbody></table></div>}
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
            {users.length === 0 ? <p className="empty-state">No intake users yet.</p> : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Fitness focus</th><th>Matched trainer</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.userId}><td>{user.fullName}</td><td>{user.email}</td><td>{user.fitnessFocus}</td><td>{user.coachName || 'No match available'}</td><td>{user.accountStatus || 'Lead'}</td><td>{new Date(`${user.createdAt.replace(' ', 'T')}Z`).toLocaleString()}</td><td><div className="coach-actions"><button type="button" onClick={() => editUser(user)} aria-label={`Edit ${user.fullName}`} disabled={Boolean(deletingUserId)}><Pencil size={14} />Edit</button><button type="button" className="delete-coach" onClick={() => deleteUser(user)} aria-label={`Delete ${user.fullName}`} disabled={Boolean(deletingUserId)}><Trash2 size={14} />{deletingUserId === user.userId ? 'Deleting...' : 'Delete'}</button></div></td></tr>)}</tbody></table></div>}
          </section>
          <button className="admin-logout" onClick={() => { setAuthenticated(false); setToken(''); setEntries(null); setUsers([]); setCoaches([]); }}>Lock admin dashboard</button>
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
  const [form, setForm] = useState({ name: '', email: '' });
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
            <p className="intake-instruction">{matchedCoach ? `Your recommended trainer is ${matchedCoach.fullName} (${matchedCoach.specialties}).` : 'We’ll be in touch when a trainer matching your focus is available.'}</p>
            <a className="intake-next" href="/">Back to Forme <ArrowRight size={18} /></a>
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

function App() {
  if (window.location.pathname === '/admin') return <AdminDashboard />;
  if (window.location.pathname === '/intake') return <IntakePage />;
  return <LandingPage />;
}

createRoot(document.getElementById('root')).render(<App />);

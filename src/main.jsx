import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, Dumbbell,
  Heart, MapPin, Menu, MoveUpRight, Sparkles, Star, X,
} from 'lucide-react';
import './styles.css';

const trainers = [
  {
    name: 'Maya Chen', specialty: 'Strength & confidence', location: 'Brooklyn, NY',
    rate: 85, rating: '4.98', sessions: '1:1 or small group', initials: 'MC',
    image: 'photo-1534528741775-53994a69daeb',
    color: 'lavender',
    expertise: ['Strength training', 'Beginner friendly', 'Women?s wellness'],
    gains: 'Build real-world strength, feel at home in the gym, and create a routine that sticks.',
  },
  {
    name: 'Jordan Ellis', specialty: 'Mobility & movement', location: 'Silver Lake, LA',
    rate: 95, rating: '4.96', sessions: 'In-person or online', initials: 'JE',
    image: 'photo-1500648767791-00dcc994a43e',
    color: 'peach',
    expertise: ['Mobility', 'Injury-aware', 'Functional fitness'],
    gains: 'Move without limits, improve posture, and get back to the activities you love.',
  },
  {
    name: 'Amara Okafor', specialty: 'Running & endurance', location: 'Austin, TX',
    rate: 75, rating: '5.0', sessions: 'Outdoor or online', initials: 'AO',
    image: 'photo-1531123897727-8f129e1688ce',
    color: 'sage',
    expertise: ['Run coaching', 'Endurance', 'Race prep'],
    gains: 'Find your pace, train smarter, and cross your next finish line feeling strong.',
  },
  {
    name: 'Leo Martinez', specialty: 'Strength & conditioning', location: 'Queens, NY',
    rate: 80, rating: '4.94', sessions: '1:1 or at-home', initials: 'LM',
    image: 'photo-1506794778202-cad84cf45f1d',
    color: 'butter',
    expertise: ['Weight training', 'Sports performance', 'At-home plans'],
    gains: 'Build power, sharpen your athletic edge, and make every workout count.',
  },
];

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
  return (
    <article className={`trainer-card card-${trainer.color}`} style={{ '--card-index': index }}>
      <div className="trainer-photo-wrap">
        <img className="trainer-photo" src={`https://images.unsplash.com/${trainer.image}?auto=format&fit=crop&w=720&q=85`} alt={`${trainer.name}, personal trainer`} loading="lazy" />
        <span className="trainer-location"><MapPin size={13} />{trainer.location}</span>
        <button className="save-trainer" aria-label={`Save ${trainer.name}`}><Heart size={17} /></button>
        <span className="session-label">{trainer.sessions}</span>
      </div>
      <div className="trainer-info">
        <div className="trainer-heading">
          <div><h3>{trainer.name}</h3><p>{trainer.specialty}</p></div>
          <div className="rating"><Star size={14} fill="currentColor" /> {trainer.rating}</div>
        </div>
        <div className="expertise-list">{trainer.expertise.map((item) => <span key={item}>{item}</span>)}</div>
        <p className="trainer-gains">{trainer.gains}</p>
        <div className="trainer-footer"><span className="rate"><strong>${trainer.rate}</strong> <span>/ hour</span></span><a href="#waitlist" className="profile-link">Meet {trainer.name.split(' ')[0]} <ArrowRight size={15} /></a></div>
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadEntries(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/waitlist', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load entries.');
      setEntries(result.entries);
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the server.');
      setEntries(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-page">
      <a className="brand" href="/"><span className="brand-mark"><Dumbbell size={19} /></span>forme<span className="brand-dot">.</span></a>
      <section className="admin-panel">
        <span className="eyebrow">FORME ? ADMIN</span>
        <h1>Waitlist responses</h1>
        <p>Enter your admin token to view signups stored in the database.</p>
        <form className="admin-form" onSubmit={loadEntries}>
          <label htmlFor="admin-token">Admin token</label>
          <input id="admin-token" type="password" autoComplete="current-password" required value={token} onChange={(event) => setToken(event.target.value)} placeholder="Your ADMIN_TOKEN" />
          <button className="button button-dark" disabled={loading}>{loading ? 'Loading...' : 'View responses'} <ArrowRight size={16} /></button>
        </form>
        {error && <p className="form-message error" role="alert">{error}</p>}
        {entries && <div className="entries"><div className="entries-heading"><h2>Signups</h2><span>{entries.length} total</span></div>{entries.length === 0 ? <p className="empty-state">No signups yet.</p> : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Goal</th><th>Joined</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{entry.name}</td><td>{entry.email}</td><td>{entry.goal || '?'}</td><td>{new Date(`${entry.createdAt.replace(' ', 'T')}Z`).toLocaleString()}</td></tr>)}</tbody></table></div>}</div>}
      </section>
    </main>
  );
}

function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="kicker-line" />A better kind of personal training</div>
            <h1>Find your<br /><span>kind of strong.</span></h1>
            <p className="hero-description">The right trainer changes everything. Meet thoughtful coaches who see you, get your goals, and make getting stronger feel like your thing.</p>
            <div className="hero-actions"><a href="#trainers" className="button button-dark">Find your trainer <ArrowRight size={17} /></a><a href="#how-it-works" className="text-link">See how it works <ArrowDown size={15} /></a></div>
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
          <div className="trainer-grid">{trainers.map((trainer, index) => <TrainerCard key={trainer.name} trainer={trainer} index={index} />)}</div>
          <div className="trainer-footnote"><span><span className="online-dot" /> Coaches accepting new clients</span><a href="#waitlist">Want us to find your match? <ArrowRight size={15} /></a></div>
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

function App() {
  return window.location.pathname === '/admin' ? <AdminDashboard /> : <LandingPage />;
}

createRoot(document.getElementById('root')).render(<App />);

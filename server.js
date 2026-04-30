require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');

const db = require('./db');
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const matchRoutes = require('./routes/match');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './' }),
  secret: process.env.SESSION_SECRET || 'campusfind-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Routes
app.use('/auth', authRoutes);
app.use('/items', itemRoutes);
app.use('/match', matchRoutes);

// Serve HTML pages
const pages = ['login', 'register', 'verify', 'dashboard', 'report', 'match', 'browse'];
pages.forEach(page => {
  app.get(`/${page === 'login' ? '' : page}`, (req, res) => {
    if (page !== 'login' && page !== 'register' && page !== 'verify' && !req.session.userId) {
      return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
});

// Root redirect
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => console.log(`CampusFind running on port ${PORT}`));

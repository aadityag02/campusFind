const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'campusfind.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    otp TEXT,
    otp_expiry INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('lost','found')),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    date_occurred TEXT NOT NULL,
    image_path TEXT,
    image_description TEXT,
    status TEXT DEFAULT 'active',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

module.exports = db;

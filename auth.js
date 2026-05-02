const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('../db');

const ALLOWED_DOMAIN = 'iitrpr.ac.in';

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// REGISTER
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return res.json({ success: false, message: `Only @${ALLOWED_DOMAIN} email addresses are allowed.` });
  }

  if (!name || !password || password.length < 6) {
    return res.json({ success: false, message: 'Please fill all fields. Password must be at least 6 characters.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = Date.now() + 15 * 60 * 1000; // 15 mins

    db.run(
      `INSERT INTO users (name, email, password, otp, otp_expiry) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name=excluded.name, password=excluded.password, otp=excluded.otp, otp_expiry=excluded.otp_expiry, verified=0`,
      [name, email, hash, otp, otpExpiry],
      async function (err) {
        if (err) return res.json({ success: false, message: 'Registration failed. Try again.' });

        // Send OTP email
        try {
          const transporter = getTransporter();
          await transporter.sendMail({
            from: `"CampusFind IIT Ropar" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your CampusFind Verification Code',
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
                <h2 style="color: #1a1a2e; margin-bottom: 8px;">CampusFind</h2>
                <p style="color: #555;">Hi ${name}, your verification code is:</p>
                <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e; padding: 24px 0;">${otp}</div>
                <p style="color: #888; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
              </div>
            `
          });
          res.json({ success: true, message: 'OTP sent to your email.', email });
        } catch (emailErr) {
          console.error('Email error:', emailErr);
          res.json({ success: false, message: 'Could not send OTP email. Check server email config.' });
        }
      }
    );
  } catch (e) {
    res.json({ success: false, message: 'Server error.' });
  }
});

// VERIFY OTP
router.post('/verify', (req, res) => {
  const { email, otp } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err || !user) return res.json({ success: false, message: 'User not found.' });
    if (user.otp !== otp) return res.json({ success: false, message: 'Invalid OTP.' });
    if (Date.now() > user.otp_expiry) return res.json({ success: false, message: 'OTP expired. Register again.' });

    db.run(`UPDATE users SET verified = 1, otp = NULL WHERE email = ?`, [email], (err2) => {
      if (err2) return res.json({ success: false, message: 'Verification failed.' });
      req.session.userId = user.id;
      req.session.userName = user.name;
      res.json({ success: true, message: 'Account verified!' });
    });
  });
});

// LOGIN
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return res.json({ success: false, message: `Only @${ALLOWED_DOMAIN} accounts allowed.` });
  }
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) return res.json({ success: false, message: 'No account found with this email.' });
    if (!user.verified) return res.json({ success: false, message: 'Please verify your email first.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, message: 'Incorrect password.' });
    req.session.userId = user.id;
    req.session.userName = user.name;
    res.json({ success: true });
  });
});

// LOGOUT
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// SESSION CHECK
router.get('/me', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, name: req.session.userName, id: req.session.userId });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;

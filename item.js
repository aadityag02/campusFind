const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const OpenAI = require('openai');
const fs = require('fs');
const db = require('../db');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  next();
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `item_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Generate image description using GPT-4o Vision
async function describeImage(imagePath) {
  try {
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const ext = path.extname(imagePath).slice(1).toLowerCase();
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe this lost/found item in detail for matching purposes. Include: object type, color, brand if visible, size, condition, distinctive features. Be concise but specific. Output as a single paragraph.'
          },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }],
      max_tokens: 200
    });
    return response.choices[0].message.content;
  } catch (e) {
    console.error('Vision error:', e.message);
    return null;
  }
}

// REPORT ITEM (lost or found)
router.post('/report', requireAuth, upload.single('image'), async (req, res) => {
  const { type, title, category, description, location, date_occurred } = req.body;
  const userId = req.session.userId;

  if (!type || !title || !category || !location || !date_occurred) {
    return res.json({ success: false, message: 'Please fill all required fields.' });
  }

  let imagePath = null;
  let imageDescription = null;

  if (req.file) {
    imagePath = '/uploads/' + req.file.filename;
    imageDescription = await describeImage(req.file.path);
  }

  db.run(
    `INSERT INTO items (user_id, type, title, category, description, location, date_occurred, image_path, image_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, title, category, description, location, date_occurred, imagePath, imageDescription],
    function (err) {
      if (err) return res.json({ success: false, message: 'Failed to save item.' });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// GET ALL ITEMS (with optional filters)
router.get('/browse', requireAuth, (req, res) => {
  const { type, category, search } = req.query;
  let query = `SELECT items.*, users.name as reporter_name FROM items JOIN users ON items.user_id = users.id WHERE items.status = 'active'`;
  const params = [];

  if (type && (type === 'lost' || type === 'found')) {
    query += ` AND items.type = ?`;
    params.push(type);
  }
  if (category) {
    query += ` AND items.category = ?`;
    params.push(category);
  }
  if (search) {
    query += ` AND (items.title LIKE ? OR items.description LIKE ? OR items.location LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY items.created_at DESC LIMIT 100`;

  db.all(query, params, (err, rows) => {
    if (err) return res.json({ success: false, message: 'Failed to fetch items.' });
    res.json({ success: true, items: rows });
  });
});

// MARK ITEM AS RESOLVED
router.post('/resolve/:id', requireAuth, (req, res) => {
  db.run(
    `UPDATE items SET status = 'resolved' WHERE id = ? AND user_id = ?`,
    [req.params.id, req.session.userId],
    function (err) {
      if (err || this.changes === 0) return res.json({ success: false, message: 'Could not resolve item.' });
      res.json({ success: true });
    }
  );
});

// MY ITEMS
router.get('/mine', requireAuth, (req, res) => {
  db.all(
    `SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC`,
    [req.session.userId],
    (err, rows) => {
      if (err) return res.json({ success: false });
      res.json({ success: true, items: rows });
    }
  );
});

module.exports = router;

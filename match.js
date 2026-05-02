const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const db = require('../db');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => cb(null, `match_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/search', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.json({ success: false, message: 'Please upload an image.' });

  const searchType = req.body.search_type || 'both'; // lost, found, or both

  try {
    // Step 1: Describe the uploaded image with GPT-4o Vision
    const imageData = fs.readFileSync(req.file.path);
    const base64 = imageData.toString('base64');
    const ext = path.extname(req.file.filename).slice(1).toLowerCase();
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

    const visionResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'You are helping match lost and found items. Describe this item in detail: object type, color, brand, size, condition, any distinctive features or markings. Be specific. Output as one paragraph.'
          },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }],
      max_tokens: 250
    });

    const uploadedDescription = visionResponse.choices[0].message.content;

    // Step 2: Fetch all active items from DB that have image descriptions
    let query = `SELECT * FROM items WHERE status = 'active' AND image_description IS NOT NULL`;
    const params = [];
    if (searchType === 'lost' || searchType === 'found') {
      query += ` AND type = ?`;
      params.push(searchType);
    }

    db.all(query, params, async (err, items) => {
      if (err) return res.json({ success: false, message: 'DB error.' });
      if (items.length === 0) return res.json({ success: true, matches: [], uploadedDescription });

      // Step 3: Use GPT-4o to semantically score each item against the uploaded image description
      const itemSummaries = items.map((item, i) =>
        `[${i}] ID:${item.id} | Type:${item.type} | Title:${item.title} | Category:${item.category} | Location:${item.location} | Description: ${item.image_description}`
      ).join('\n');

      const matchResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `You are a lost & found matching assistant. A user uploaded an image of: "${uploadedDescription}"

Below are items in the database. Score each from 0-100 on how likely it is the same item. Consider object type, color, brand, size, and features. Return ONLY a JSON array like:
[{"index": 0, "score": 85, "reason": "Same blue water bottle with matching brand"}, ...]

Items:
${itemSummaries}`
        }],
        max_tokens: 800
      });

      let scores = [];
      try {
        const raw = matchResponse.choices[0].message.content;
        const jsonStr = raw.replace(/```json|```/g, '').trim();
        scores = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Parse error:', e.message);
      }

      // Merge scores with item data, filter score >= 30, sort descending
      const matches = scores
        .map(s => ({ ...items[s.index], score: s.score, reason: s.reason }))
        .filter(m => m && m.score >= 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      // Clean up temp file
      fs.unlink(req.file.path, () => {});

      res.json({ success: true, matches, uploadedDescription });
    });

  } catch (e) {
    console.error('Match error:', e.message);
    res.json({ success: false, message: 'Image matching failed. Check OpenAI API key.' });
  }
});

module.exports = router;

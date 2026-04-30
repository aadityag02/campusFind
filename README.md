# CampusFind — IIT Ropar Lost & Found Platform

A full-stack web application for the IIT Ropar campus that lets students report lost and found items, browse reports, and use AI-powered image matching via GPT-4o.

---

## Features

- **Email-restricted registration** — only `@iitrpr.ac.in` emails allowed
- **OTP email verification** — account must be verified before access
- **Report Lost / Found items** — with category, location, date, description, photo
- **Browse & filter** — search all active reports by keyword, category, type
- **AI Image Matching** — GPT-4o Vision analyzes uploaded photos and ranks database matches by similarity score with explanations
- **Mark Resolved** — close a report once an item is returned

---

## Project Structure

```
campusfind/
├── server.js           # Express app entry point
├── db.js               # SQLite database setup
├── routes/
│   ├── auth.js         # Register, verify OTP, login, logout
│   ├── items.js        # Report, browse, resolve items
│   └── match.js        # GPT-4o image matching
├── public/
│   ├── css/style.css   # All styles
│   ├── login.html
│   ├── register.html
│   ├── verify.html
│   ├── dashboard.html
│   ├── report.html
│   ├── browse.html
│   └── match.html
├── .env.example        # Environment variables template
├── render.yaml         # Render deployment config
└── package.json
```

---

## Local Setup

1. **Clone and install**
   ```bash
   git clone <your-repo>
   cd campusfind
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Get your API keys**
   - **OpenAI**: https://platform.openai.com/api-keys (needs GPT-4o access)
   - **Gmail App Password**: https://myaccount.google.com/apppasswords
     - Enable 2FA on your Gmail first, then create an App Password

4. **Run locally**
   ```bash
   npm start
   # Open http://localhost:3000
   ```

---

## Deploy to Render (Free Tier)

1. Push your code to a **GitHub repository** (make sure `.env` is in `.gitignore`)

2. Go to [render.com](https://render.com) → **New Web Service**

3. Connect your GitHub repo

4. Settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

5. Add **Environment Variables** in Render dashboard:
   | Key | Value |
   |-----|-------|
   | `OPENAI_API_KEY` | Your OpenAI key |
   | `EMAIL_USER` | your-gmail@gmail.com |
   | `EMAIL_PASS` | Gmail App Password |
   | `SESSION_SECRET` | Any random string |

6. Click **Deploy** — your site will be live in ~2 minutes

> **Note**: Render's free tier spins down after 15 min of inactivity. Uploaded images are stored locally and will reset on redeploy. For production use, switch to Cloudinary for images and a persistent database like Render PostgreSQL.

---

## Important Notes

- **Image uploads** are stored in `public/uploads/` locally. On Render free tier these reset on redeploy. Fine for demo purposes.
- **SQLite DB** (`campusfind.db`) is ephemeral on Render free tier. For persistent data, upgrade to a Render PostgreSQL instance and adapt `db.js` to use `pg` instead of `sqlite3`.
- **OTP emails** require a valid Gmail with App Password. Test this locally first.
- **GPT-4o image matching** costs OpenAI credits per API call. Each match search makes 2 GPT-4o calls (one to describe the uploaded image, one to score matches). Keep this in mind for usage.

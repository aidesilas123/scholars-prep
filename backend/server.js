const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Serve static frontend files from project root
app.use(express.static(path.join(__dirname, '..')));

// ✅ Alias routes (so dashboard.html / Dashboard.html both work)
const ROOT = path.join(__dirname, '..');
function sendFirstExisting(res, candidates) {
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) return res.sendFile(abs);
  }
  return res.status(404).send('File not found.');
}
app.get('/login',  (req,res)=> sendFirstExisting(res, ['login.html','Login.html']));
app.get('/signup', (req,res)=> sendFirstExisting(res, ['signup.html','Signup.html']));
app.get('/dashboard', (req,res)=> sendFirstExisting(res, ['dashboard.html','Dashboard.html']));

// ✅ Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ✅ DB connectivity check
app.get('/db-check', async (req, res) => {
  try {
    await db.query('SELECT 1;');
    res.json({ db: 'connected' });
  } catch (err) {
    res.status(500).json({ db: 'error', message: err.message });
  }
});

// ✅ Test fetch questions
app.get('/questions', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM questions LIMIT 10;');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// ✅ CBT route
app.get('/cbt', async (req, res) => {
  try {
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const { course, type, year } = req.query;

    if (!course || !type || !year) {
      return res.status(400).json({ error: 'course, type, and year are required' });
    }
    const yr = Number(year);
    if (!Number.isInteger(yr) || yr < 2018 || yr > 2025) {
      return res.status(400).json({ error: 'year must be between 2018 and 2025' });
    }

    const sql = `
      SELECT q.id, q.year, q.question_text, q.options, q.answer
      FROM questions q
      JOIN courses c ON c.id = q.course_id
      WHERE c.code = $1 AND c.type = $2 AND q.year = $3
      ORDER BY RANDOM()
    `;
    const { rows } = await db.query(sql, [course, type.toLowerCase(), yr]);

    const questions = rows.map(r => {
      const optsObj = r.options || {};
      const optsArray = letters.map(k => optsObj[k]).filter(v => typeof v === 'string' && v.length > 0);

      return {
        id: r.id,
        year: r.year,
        question: r.question_text,
        options: optsArray,
        answerLetter: r.answer,
        answerIndex: letters.indexOf(r.answer)
      };
    });

    res.json({
      course,
      type,
      year: yr,
      count: questions.length,
      questions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'CBT fetch failed', details: err.message });
  }
});

// ✅ Past Questions route
app.get('/pastq', async (req, res) => {
  try {
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const { course, type } = req.query;

    if (!course || !type) {
      return res.status(400).json({ error: 'course and type are required' });
    }

    const sql = `
      SELECT q.id, q.year, q.question_text, q.options, q.answer
      FROM questions q
      JOIN courses c ON c.id = q.course_id
      WHERE c.code = $1 AND c.type = $2 AND q.year BETWEEN 2019 AND 2025
      ORDER BY RANDOM()
    `;
    const { rows } = await db.query(sql, [course, type.toLowerCase()]);

    const questions = rows.map(r => {
      const optsObj = r.options || {};
      const optsArray = letters.map(k => optsObj[k]).filter(v => typeof v === 'string' && v.length > 0);

      return {
        id: r.id,
        year: r.year,
        question: r.question_text,
        options: optsArray,
        answerLetter: r.answer,
        answerIndex: letters.indexOf(r.answer)
      };
    });

    res.json({
      course,
      type,
      yearRange: "2019–2025",
      count: questions.length,
      questions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'PastQ fetch failed', details: err.message });
  }
});

// 🔑 Signup API
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      'INSERT INTO users (email, password_hash, active_session) VALUES ($1, $2, false) RETURNING id, email',
      [email, hashedPassword]
    );

    res.json({ message: "Signup successful", user: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      res.status(400).json({ error: "Email already exists" });
    } else {
      res.status(500).json({ error: "Signup failed" });
    }
  }
});

// 🔑 Login API
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await db.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "No account found with this email" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // ✅ Mark session as active
    await db.query('UPDATE users SET active_session = true WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'supersecret',
      { expiresIn: '12h' }
    );

    res.json({
      message: "Login successful",
      user: { id: user.id, email: user.email },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// 🔑 Logout API
app.post('/logout', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    await db.query('UPDATE users SET active_session = false WHERE email = $1', [email]);
    res.json({ message: "Logout successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Logout failed" });
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

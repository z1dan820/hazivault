// server/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_PATH = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_PATH, 'users.json');

// ensure data folder exists
if (!fs.existsSync(DATA_PATH)) fs.mkdirSync(DATA_PATH);

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username & password required' });

  const hashed = await bcrypt.hash(password, 10);
  const user = { username, password: hashed };

  fs.writeFileSync(USERS_FILE, JSON.stringify([user]));
  res.json({ success: true });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!fs.existsSync(USERS_FILE)) return res.status(401).json({ error: 'Not registered' });

  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const match = await bcrypt.compare(password, users[0].password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ success: true });
});

module.exports = router;

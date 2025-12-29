
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./db');

const router = express.Router();

// cek apakah sudah ada user
router.get('/exists', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM users', (err, row) => {
    res.json({ exists: row.total > 0 });
  });
});

// register admin (sekali saja)
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'required' });

  const hash = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, hash],
    err => {
      if (err) return res.status(400).json({ error: 'exists' });
      res.json({ success: true });
    }
  );
});

// login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (!user) return res.status(401).json({ error: 'invalid' });

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: 'invalid' });

      req.session.user = { id: user.id, username: user.username };
      res.json({ success: true });
    }
  );
});

module.exports = router;

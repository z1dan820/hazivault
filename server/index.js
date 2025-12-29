
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./auth');

const app = express();
const PORT = 8787;

app.use(express.json());
app.use(session({
  secret: 'hazivault-secret',
  resave: false,
  saveUninitialized: false
}));

app.use('/api/auth', authRoutes);
app.use('/', express.static(path.join(__dirname, '../web')));

app.listen(PORT, () => {
  console.log(`HaziVault running on http://localhost:${PORT}`);
});

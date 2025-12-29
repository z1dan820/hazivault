const express = require('express');
const path = require('path');

const app = express();
const PORT = 8787;

app.use('/', express.static(path.join(__dirname, '../web')));

app.get('/api/ping', (req, res) => {
  res.json({ app: 'HaziVault', status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`HaziVault running at http://localhost:${PORT}`);
});

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Pastikan folder data ada
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'hazivault.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('DB Connection Error:', err.message);
    else console.log('Connected to HaziVault Database.');
});

// Init Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);
    
    // Default admin (password: admin123) - Ganti hash ini nanti untuk production!
    // Hash ini adalah bcrypt dari 'admin123'
    const defaultHash = '$2a$10$X.v.H.u/./././././././.u'; // Placeholder hash
    // Logika insert default user sebaiknya dilakukan saat register setup
});

module.exports = db;


const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { getStorageInfo } = require('./storage');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../web')));
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));
app.use('/images', express.static(path.join(__dirname, '../images'))); // Untuk logo

// Setup Storage Multer
const uploadDir = path.join(__dirname, '../data/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// --- API ROUTES ---

// 1. Auth Login (Sederhana)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: "User not found" });

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: "Invalid password" });

        res.json({ message: "Login success", user: { id: user.id, username: user.username } });
    });
});

// 2. Auth Register (Untuk Setup Awal)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function(err) {
        if (err) return res.status(500).json({ error: "Username already exists or DB error" });
        res.json({ message: "User registered" });
    });
});

// 3. System Info (Storage)
app.get('/api/storage', async (req, res) => {
    const disks = await getStorageInfo();
    res.json(disks);
});

// 4. File Operations
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.json({ message: 'File uploaded successfully', file: req.file });
});

app.get('/api/files', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Cannot scan files" });
        
        const fileInfos = files.map(file => {
            const stat = fs.statSync(path.join(uploadDir, file));
            return {
                name: file,
                size: (stat.size / 1024 / 1024).toFixed(2) + ' MB',
                created: stat.birthtime,
                type: path.extname(file).toLowerCase()
            };
        });
        res.json(fileInfos);
    });
});

app.post('/api/delete', (req, res) => {
    const { filename } = req.body;
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ message: "Deleted" });
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

// Serve HTML Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../web/index.html'))); // Landing/Login
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../web/dashboard.html')));

app.listen(PORT, () => {
    console.log(`🚀 HaziVault NAS running on http://localhost:${PORT}`);
});

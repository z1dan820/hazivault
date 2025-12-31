const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const os = require('os');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'hazivault.db');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const IMAGES_DIR = path.join(__dirname, '../images');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load Config / Active Storage
let ACTIVE_STORAGE_ROOT = path.join(DATA_DIR, 'uploads');
if (fs.existsSync(CONFIG_PATH)) {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
        if (config.storagePath && fs.existsSync(config.storagePath)) {
            ACTIVE_STORAGE_ROOT = config.storagePath;
            console.log(`📂 Config Loaded: ${ACTIVE_STORAGE_ROOT}`);
        }
    } catch (e) { console.error("Config Error", e); }
} else {
    if (!fs.existsSync(ACTIVE_STORAGE_ROOT)) fs.mkdirSync(ACTIVE_STORAGE_ROOT, { recursive: true });
}

// --- DATABASE ---
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, token TEXT)`);
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../web')));
app.use('/images', express.static(IMAGES_DIR));

const authMiddleware = (req, res, next) => {
    if (req.path.startsWith('/api/login') || req.path.startsWith('/api/register') || !req.path.startsWith('/api')) return next();
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    db.get("SELECT * FROM users WHERE token = ?", [token], (err, user) => {
        if (!user) return res.status(401).json({ error: "Invalid Token" });
        req.user = user;
        next();
    });
};
app.use(authMiddleware);

app.get('/uploads/*', (req, res) => {
    const relativePath = decodeURIComponent(req.path.replace('/uploads/', ''));
    const fullPath = path.join(ACTIVE_STORAGE_ROOT, relativePath);
    if (fs.existsSync(fullPath)) res.sendFile(fullPath);
    else res.status(404).send('Not Found');
});

// --- MULTER (STORAGE ENGINE) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dest = ACTIVE_STORAGE_ROOT;
        if (req.body.path) {
            const safePath = path.normalize(req.body.path).replace(/^(\.\.[\/\\])+/, '');
            dest = path.join(ACTIVE_STORAGE_ROOT, safePath);
        }
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// --- ROUTES ---

// Auth
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (!user) return res.status(400).json({ error: "User not found" });
        if (!await bcrypt.compare(password, user.password)) return res.status(400).json({ error: "Wrong password" });
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        db.run("UPDATE users SET token = ? WHERE id = ?", [token, user.id]);
        res.json({ message: "Login Success", token, username: user.username });
    });
});

app.post('/api/register', async (req, res) => {
    db.get("SELECT count(*) as count FROM users", async (err, row) => {
        if (row.count > 0) return res.status(403).json({ error: "System Initialized" });
        const hash = await bcrypt.hash(req.body.password, 10);
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", [req.body.username, hash], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Setup Complete" });
        });
    });
});

// Stats
app.get('/api/sys-stats', (req, res) => {
    const total = os.totalmem(), free = os.freemem(), cpus = os.cpus();
    let load = 0;
    cpus.forEach(c => { load += ((Object.values(c.times).reduce((a, b) => a + b) - c.times.idle) / Object.values(c.times).reduce((a, b) => a + b)) * 100; });
    exec('df -h --output=source,size,used,avail,pcent,target', (err, stdout) => {
        let disks = [];
        if (!err) stdout.trim().split('\n').slice(1).forEach(l => {
            const p = l.trim().split(/\s+/);
            if (p.length >= 6 && (p[5] === '/' || p[5].startsWith('/mnt') || p[5].includes('storage') || p[5].startsWith('/media'))) 
                disks.push({ mount: p[5], size: p[1], used: p[2], avail: p[3], percent: p[4] });
        });
        res.json({ cpu: (load / cpus.length).toFixed(1) + "%", memUsed: ((total - free) / 1073741824).toFixed(2) + " GB", storage: disks });
    });
});

// Storage Logic
app.get('/api/active-storage', (req, res) => res.json({ path: ACTIVE_STORAGE_ROOT }));
app.post('/api/set-storage', (req, res) => {
    const { newPath } = req.body;
    if (!newPath || !fs.existsSync(newPath)) return res.status(400).json({ error: "Invalid Path" });
    const target = path.join(newPath, 'hazi_uploads');
    if (!fs.existsSync(target)) { try { fs.mkdirSync(target, { recursive: true }); } catch (e) { return res.status(500).json({ error: "Permission Denied" }); } }
    ACTIVE_STORAGE_ROOT = target;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ storagePath: ACTIVE_STORAGE_ROOT }));
    res.json({ message: "Storage Changed", active: ACTIVE_STORAGE_ROOT });
});

// File Ops
app.get('/api/files', (req, res) => {
    const safePath = path.normalize(req.query.path || '').replace(/^(\.\.[\/\\])+/, '');
    const targetDir = path.join(ACTIVE_STORAGE_ROOT, safePath);
    if (!fs.existsSync(targetDir)) return res.json([]);
    fs.readdir(targetDir, { withFileTypes: true }, (err, entries) => {
        if (err) return res.status(500).json({ error: "Read Error" });
        const files = entries.map(e => {
            let stats = { size: 0 };
            try { stats = fs.statSync(path.join(targetDir, e.name)); } catch (x) {}
            return { name: e.name, isDir: e.isDirectory(), size: e.isDirectory() ? '-' : (stats.size / 1048576).toFixed(2) + ' MB', type: path.extname(e.name).toLowerCase() };
        });
        res.json(files.sort((a, b) => (a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1)));
    });
});

// --- UPDATED: UPLOAD ARRAY ---
app.post('/api/upload', upload.array('files'), (req, res) => res.json({ message: "Uploaded", count: req.files.length }));

// --- NEW: BULK DELETE ---
app.post('/api/bulk-delete', (req, res) => {
    const { targets } = req.body;
    if (!targets || !Array.isArray(targets)) return res.status(400).json({ error: "Invalid targets" });
    let count = 0;
    targets.forEach(t => {
        const full = path.join(ACTIVE_STORAGE_ROOT, path.normalize(t).replace(/^(\.\.[\/\\])+/, ''));
        try { 
            if (fs.existsSync(full)) {
                fs.lstatSync(full).isDirectory() ? fs.rmSync(full, { recursive: true, force: true }) : fs.unlinkSync(full);
                count++;
            }
        } catch (e) {}
    });
    res.json({ message: "Deleted", deleted: count });
});

// Standard Ops
app.post('/api/create-folder', (req, res) => {
    const target = path.join(ACTIVE_STORAGE_ROOT, path.normalize(req.body.folderName).replace(/^(\.\.[\/\\])+/, ''));
    if (fs.existsSync(target)) return res.status(400).json({ error: "Exists" });
    fs.mkdirSync(target, { recursive: true }); res.json({ message: "Created" });
});
app.post('/api/delete', (req, res) => { /* Single delete logic is redundant if frontend uses bulk, but kept for legacy */
    const target = path.join(ACTIVE_STORAGE_ROOT, path.normalize(req.body.target).replace(/^(\.\.[\/\\])+/, ''));
    try { fs.lstatSync(target).isDirectory() ? fs.rmSync(target, { recursive: true, force: true }) : fs.unlinkSync(target); res.json({ message: "Deleted" }); } catch(e){ res.status(500).json({error:"Fail"}); }
});
app.post('/api/rename', (req, res) => {
    const oldP = path.join(ACTIVE_STORAGE_ROOT, path.normalize(req.body.oldPath).replace(/^(\.\.[\/\\])+/, ''));
    const newP = path.join(path.dirname(oldP), path.basename(req.body.newName));
    try { fs.renameSync(oldP, newP); res.json({ message: "Renamed" }); } catch(e){ res.status(500).json({error:"Fail"}); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../web/index.html')));

app.listen(PORT, () => {
    console.log(`🚀 HaziVault v3.0 running on ${PORT}`);
    console.log(`📂 Active Storage: ${ACTIVE_STORAGE_ROOT}`);
});

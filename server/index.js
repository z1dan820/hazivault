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

// Ensure Data Dir Exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load / Init Storage Config
let ACTIVE_STORAGE_ROOT = path.join(DATA_DIR, 'uploads'); // Default

if (fs.existsSync(CONFIG_PATH)) {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
        if (config.storagePath && fs.existsSync(config.storagePath)) {
            ACTIVE_STORAGE_ROOT = config.storagePath;
            console.log(`📂 Config Loaded: Active Storage -> ${ACTIVE_STORAGE_ROOT}`);
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

// Middleware Auth
const authMiddleware = (req, res, next) => {
    if (req.path.startsWith('/api/login') || req.path.startsWith('/api/register') || !req.path.startsWith('/api')) {
        return next();
    }
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    db.get("SELECT * FROM users WHERE token = ?", [token], (err, user) => {
        if (!user) return res.status(401).json({ error: "Invalid Token" });
        req.user = user;
        next();
    });
};
app.use(authMiddleware);

// Endpoint khusus untuk melayani file dari storage aktif
app.get('/uploads/*', (req, res) => {
    // Ambil path relatif dari URL (hapus '/uploads/')
    const relativePath = decodeURIComponent(req.path.replace('/uploads/', ''));
    const fullPath = path.join(ACTIVE_STORAGE_ROOT, relativePath);

    if (fs.existsSync(fullPath)) {
        res.sendFile(fullPath);
    } else {
        res.status(404).send('Not Found');
    }
});

// --- MULTER STORAGE ---
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
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: "Wrong password" });
        
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        db.run("UPDATE users SET token = ? WHERE id = ?", [token, user.id]);
        res.json({ message: "Login Success", token, username: user.username });
    });
});

app.post('/api/register', async (req, res) => {
    db.get("SELECT count(*) as count FROM users", async (err, row) => {
        if (row.count > 0) return res.status(403).json({ error: "System already initialized" });
        const { username, password } = req.body;
        const hash = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Setup Complete" });
        });
    });
});

// System Stats & Storage List
app.get('/api/sys-stats', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();
    let cpuLoad = 0;
    cpus.forEach(cpu => {
        const total = Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0);
        const idle = cpu.times.idle;
        cpuLoad += ((total - idle) / total) * 100;
    });
    cpuLoad = (cpuLoad / cpus.length).toFixed(1);

    exec('df -h --output=source,size,used,avail,pcent,target', (err, stdout) => {
        let disks = [];
        if (!err) {
            const lines = stdout.trim().split('\n');
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].trim().split(/\s+/);
                if (parts.length >= 6) {
                    const mount = parts[5];
                    // Filter mount points
                    if (mount === '/' || mount.startsWith('/mnt') || mount.includes('storage') || mount.startsWith('/media')) {
                        disks.push({
                            mount, size: parts[1], used: parts[2], avail: parts[3], percent: parts[4]
                        });
                    }
                }
            }
        }
        res.json({
            cpu: cpuLoad + "%",
            memUsed: ((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2) + " GB",
            memTotal: (totalMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
            storage: disks
        });
    });
});

// Storage Management
app.get('/api/active-storage', (req, res) => res.json({ path: ACTIVE_STORAGE_ROOT }));

app.post('/api/set-storage', (req, res) => {
    const { newPath } = req.body;
    if (!newPath || !fs.existsSync(newPath)) return res.status(400).json({ error: "Invalid Path" });

    const target = path.join(newPath, 'hazi_uploads');
    if (!fs.existsSync(target)) {
        try { fs.mkdirSync(target, { recursive: true }); } 
        catch (e) { return res.status(500).json({ error: "Permission Denied" }); }
    }

    ACTIVE_STORAGE_ROOT = target;
    // Save Config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ storagePath: ACTIVE_STORAGE_ROOT }));
    
    res.json({ message: "Storage Changed", active: ACTIVE_STORAGE_ROOT });
});

// File Operations
app.get('/api/files', (req, res) => {
    const reqPath = req.query.path || '';
    const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
    const targetDir = path.join(ACTIVE_STORAGE_ROOT, safePath);

    if (!fs.existsSync(targetDir)) return res.json([]);

    fs.readdir(targetDir, { withFileTypes: true }, (err, entries) => {
        if (err) return res.status(500).json({ error: "Read error" });
        const files = entries.map(entry => {
            const fullPath = path.join(targetDir, entry.name);
            let stats = { size: 0 };
            try { stats = fs.statSync(fullPath); } catch (e) {}
            return {
                name: entry.name,
                isDir: entry.isDirectory(),
                size: entry.isDirectory() ? '-' : (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                type: path.extname(entry.name).toLowerCase()
            };
        });
        files.sort((a, b) => (a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1));
        res.json(files);
    });
});

app.post('/api/upload', upload.single('file'), (req, res) => res.json({ message: "Uploaded" }));

app.post('/api/create-folder', (req, res) => {
    const { folderName } = req.body;
    const safePath = path.normalize(folderName).replace(/^(\.\.[\/\\])+/, '');
    const target = path.join(ACTIVE_STORAGE_ROOT, safePath);
    if (fs.existsSync(target)) return res.status(400).json({ error: "Exists" });
    fs.mkdirSync(target, { recursive: true });
    res.json({ message: "Created" });
});

app.post('/api/delete', (req, res) => {
    const { target } = req.body;
    const safePath = path.normalize(target).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(ACTIVE_STORAGE_ROOT, safePath);
    try {
        if (fs.lstatSync(fullPath).isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(fullPath);
        }
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

app.post('/api/rename', (req, res) => {
    const { oldPath, newName } = req.body;
    const safeOld = path.normalize(oldPath).replace(/^(\.\.[\/\\])+/, '');
    const dir = path.dirname(safeOld);
    const safeNew = path.join(dir, path.basename(newName));
    try {
        fs.renameSync(path.join(ACTIVE_STORAGE_ROOT, safeOld), path.join(ACTIVE_STORAGE_ROOT, safeNew));
        res.json({ message: "Renamed" });
    } catch (e) { res.status(500).json({ error: "Rename failed" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../web/index.html')));

app.listen(PORT, () => {
    console.log(`🚀 HaziVault v2.5 running on ${PORT}`);
    console.log(`📂 Active Storage: ${ACTIVE_STORAGE_ROOT}`);
});

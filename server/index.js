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
// Serve file uploads agar bisa di-preview/download
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));
app.use('/images', express.static(path.join(__dirname, '../images')));

// --- Setup Storage Paths ---
const dataDir = path.join(__dirname, '../data');
const uploadDir = path.join(dataDir, 'uploads');

// Pastikan folder uploads ada saat start
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Konfigurasi Multer (Upload)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // TODO: Nanti bisa dikembangkan untuk support sub-folder upload
        cb(null, uploadDir) 
    },
    filename: (req, file, cb) => {
        // Tambah timestamp agar nama file unik
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage });


// ==============================
// API ROUTES
// ==============================

// --- AUTH ---
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

app.post('/api/register', async (req, res) => {
    // Cek apakah user admin sudah ada (untuk keamanan sederhana)
    db.get("SELECT count(*) as count FROM users", async (err, row) => {
        if (row.count > 0) {
             // Jika sudah ada user, anggap ini setup kedua kali dan tolak
             // (Hapus blok ini jika ingin multi-user register bebas)
             return res.status(403).json({ error: "System already initialized." });
        }

        const { username, password } = req.body;
        if(!username || !password) return res.status(400).json({error: "Missing fields"});
        
        const hash = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function(err) {
            if (err) return res.status(500).json({ error: "Error registering user" });
            res.json({ message: "User registered successfully" });
        });
    });
});


// --- SYSTEM INFO ---
app.get('/api/storage', async (req, res) => {
    const disks = await getStorageInfo();
    res.json(disks);
});


// --- FILE OPERATIONS ---

// 1. List Files (Update: Deteksi Folder)
app.get('/api/files', (req, res) => {
    // TODO: Nanti tambahkan query param ?path= untuk navigasi subfolder
    const currentPath = uploadDir; 

    fs.readdir(currentPath, { withFileTypes: true }, (err, entries) => {
        if (err) return res.status(500).json({ error: "Cannot scan directory" });
        
        const fileInfos = entries.map(entry => {
            const fullPath = path.join(currentPath, entry.name);
            let stats;
            try { stats = fs.statSync(fullPath); } catch(e) { stats = {size:0, birthtime: new Date()}}

            return {
                name: entry.name,
                isDir: entry.isDirectory(),
                size: entry.isDirectory() ? '-' : (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                created: stats.birthtime,
                // Ambil ekstensi jika file, jika folder kosongkan
                type: entry.isDirectory() ? 'DIR' : path.extname(entry.name).toLowerCase()
            };
        });
        
        // Sort: Folder di atas, file di bawah
        fileInfos.sort((a, b) => (a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1));

        res.json(fileInfos);
    });
});

// 2. Upload File
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.json({ message: 'File uploaded successfully', file: req.file });
});

// 3. Create Folder (NEW FEATURE)
app.post('/api/create-folder', (req, res) => {
    const { folderName } = req.body;
    if (!folderName) return res.status(400).json({ error: "Folder name required" });

    // Security: Gunakan basename untuk mencegah directory traversal (../)
    const safeName = path.basename(folderName);
    const newFolderPath = path.join(uploadDir, safeName);

    if (fs.existsSync(newFolderPath)) {
        return res.status(400).json({ error: "Folder already exists" });
    }

    try {
        fs.mkdirSync(newFolderPath);
        res.json({ message: `Folder '${safeName}' created` });
    } catch (error) {
        res.status(500).json({ error: "Failed to create folder: " + error.message });
    }
});

// 4. Delete File/Folder
app.post('/api/delete', (req, res) => {
    const { filename } = req.body;
    // Security: basename penting disini
    const safeName = path.basename(filename);
    const filePath = path.join(uploadDir, safeName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File/Folder not found" });
    }

    try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            // Hapus folder (harus kosong, atau gunakan {recursive: true} untuk paksa hapus isi)
            fs.rmdirSync(filePath); 
        } else {
            // Hapus file
            fs.unlinkSync(filePath);
        }
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        // Error biasanya jika menghapus folder yg ada isinya tanpa recursive
        res.status(500).json({ error: "Delete failed. (If deleting folder, make sure it's empty)" });
    }
});


// --- SERVE HTML ---
// Redirect root ke dashboard jika sudah login (cek sederhana di client nanti)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../web/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../web/dashboard.html')));

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 HaziVault NAS running on http://localhost:${PORT}`);
    console.log(`📁 Data Directory: ${dataDir}`);
});
                                                    

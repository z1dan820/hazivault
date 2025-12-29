
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const db = require('./db');
const { getStorageInfo } = require('./storage');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../web')));

// --- Setup Storage Paths ---
const UPLOAD_DIR = path.join(__dirname, '../data/uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true }); // Ensure base upload directory exists

// Serve file uploads so they can be previewed/downloaded
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/images', express.static(path.join(__dirname, '../images')));

// --- Security Helper ---
// Resolves a user-provided path against the UPLOAD_DIR and ensures it's safe.
function getSafePath(userPath) {
    if (!userPath) {
        return UPLOAD_DIR;
    }
    const resolvedPath = path.join(UPLOAD_DIR, userPath);
    // Security check: Ensure the resolved path is still within the upload directory
    if (!resolvedPath.startsWith(UPLOAD_DIR)) {
        throw new Error('Access denied. Path is outside of the allowed directory.');
    }
    return resolvedPath;
}

// --- Multer Configuration for Uploads ---
// We save to a temporary directory first, then move the file to the correct location in the handler.
const upload = multer({ dest: require('os').tmpdir() });

// ==============================
// API ROUTES
// ==============================

// --- AUTH ---
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (!user) return res.status(400).json({ success: false, message: "User not found" });

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ success: false, message: "Invalid password" });

        res.json({ success: true, user: { id: user.id, username: user.username } });
    });
});

app.post('/api/register', async (req, res) => {
    db.get("SELECT count(*) as count FROM users", async (err, row) => {
        if (row.count > 0) {
             return res.status(403).json({ message: "System already initialized." });
        }

        const { username, password } = req.body;
        if(!username || !password) return res.status(400).json({message: "Missing fields"});
        
        const hash = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function(err) {
            if (err) return res.status(500).json({ message: "Error registering user" });
            res.json({ message: "User registered successfully" });
        });
    });
});

// --- SYSTEM INFO ---
app.get('/api/storage', async (req, res) => {
    try {
        const disks = await getStorageInfo();
        res.json(disks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get storage info' });
    }
});


// --- FILE OPERATIONS ---

// List Files & Folders
app.get('/api/files', async (req, res) => {
    try {
        const userPath = req.query.path || '';
        const targetPath = getSafePath(userPath);

        const entries = await fsp.readdir(targetPath, { withFileTypes: true });
        
        const fileInfos = await Promise.all(entries.map(async (entry) => {
            const stats = await fsp.stat(path.join(targetPath, entry.name)).catch(() => ({ size: 0, birthtime: new Date() }));
            return {
                name: entry.name,
                isDir: entry.isDirectory(),
                size: entry.isDirectory() ? '-' : (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                type: entry.isDirectory() ? 'DIR' : path.extname(entry.name).toLowerCase(),
            };
        }));

        res.json(fileInfos);
    } catch (error) {
        console.error('File listing error:', error);
        res.status(500).json({ error: error.message || "Cannot scan directory" });
    }
});

// Upload File(s) to a specific path
app.post('/api/upload', upload.array('file'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send({ error: 'No files were uploaded.' });
    }

    try {
        const userPath = req.body.path || '';
        const destinationPath = getSafePath(userPath);
        
        // Ensure the destination subfolder exists
        await fsp.mkdir(destinationPath, { recursive: true });

        for (const file of req.files) {
            const finalPath = path.join(destinationPath, file.originalname);
            await fsp.rename(file.path, finalPath); // Move file from temp dir to final destination
        }

        res.json({ message: 'Files uploaded successfully' });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to process file upload.' });
    }
});

// Create a Folder at a specific path
app.post('/api/create-folder', async (req, res) => {
    try {
        const { folderName } = req.body; // e.g., 'new_folder' or 'existing_folder/new_folder'
        if (!folderName) {
            return res.status(400).json({ error: "Folder name is required" });
        }

        const newFolderPath = getSafePath(folderName);

        if (fs.existsSync(newFolderPath)) {
            return res.status(400).json({ error: "Folder already exists" });
        }

        await fsp.mkdir(newFolderPath, { recursive: true });
        res.json({ message: `Folder '${path.basename(folderName)}' created` });
    } catch (error) {
        res.status(500).json({ error: error.message || "Failed to create folder" });
    }
});

// Delete a File or Folder at a specific path
app.post('/api/delete', async (req, res) => {
    try {
        const { filename } = req.body; // e.g., 'file.txt' or 'folder_name'
        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        const itemPath = getSafePath(filename);

        if (!fs.existsSync(itemPath)) {
            return res.status(404).json({ error: "File or folder not found" });
        }

        // Use recursive delete for both files and directories (and their contents)
        await fsp.rm(itemPath, { recursive: true, force: true });

        res.json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete the item.' });
    }
});

// --- SERVE HTML ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../web/index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 HaziVault NAS running on http://localhost:${PORT}`);
    console.log(`- Data Directory: ${UPLOAD_DIR}`);
});
                             

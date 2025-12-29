
// --- Global State ---
let currentPath = ''; // To track the current folder path

// --- API Helper ---
const API_URL = '/api';

// --- Page Templates ---
const loginPageTemplate = `
<div class="container">
    <div class="login-card">
        <img src="/images/hazi.png" alt="Hazi Logo" class="logo">
        <h1>HaziVault</h1>
        <p>Your personal NAS</p>
        <form id="loginForm">
            <input type="text" id="username" placeholder="Username" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
    </div>
</div>
`;

const setupPageTemplate = `
<div class="container">
    <div class="login-card">
        <img src="/images/hazi.png" alt="Hazi Logo" class="logo">
        <h1>HaziVault Setup</h1>
        <p>Create your admin account</p>
        <form id="setupForm">
            <input type="text" id="username" placeholder="Username" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Create Account</button>
        </form>
    </div>
</div>
`;

const dashboardPageTemplate = `
<div class="sidebar">
    <div class="logo-container">
        <img src="/images/hazi.png" alt="Hazi Logo" class="logo">
        <div class="logo-text">
            <h1>HaziVault</h1>
            <p>NAS</p>
        </div>
    </div>
    <div class="storage-info">
        <div class="storage-bar">
            <div class="storage-fill" id="storage-fill"></div>
        </div>
        <p id="storage-text">Loading...</p>
    </div>
    <div class="user-info">
        <span id="user-greeting"></span>
        <a href="#" id="logout-btn">Logout</a>
    </div>
</div>
<div class="main-content">
    <div class="header">
        <div id="breadcrumb"></div>
        <div class="actions">
            <button id="create-folder-btn" class="action-btn"><i class="fas fa-folder-plus"></i></button>
            <button id="upload-btn" class="action-btn"><i class="fas fa-upload"></i></button>
        </div>
    </div>
    <div class="file-grid" id="file-grid">
        <!-- File and folder items will be inserted here -->
    </div>
</div>

<!-- Modals -->
<div id="uploadModal" class="modal">
    <div class="modal-content">
        <span class="close-modal">&times;</span>
        <h2>Upload Files</h2>
        <form id="uploadForm">
            <input type="file" id="fileInput" multiple required>
            <button type="submit">Upload</button>
            <div id="uploadProgress" style="display:none;">
                <p id="uploadStatus"></p>
                <div class="progress-bar">
                    <div class="progress" id="uploadBar"></div>
                </div>
            </div>
        </form>
    </div>
</div>

<div id="createFolderModal" class="modal">
    <div class="modal-content">
        <span class="close-modal">&times;</span>
        <h2>Create Folder</h2>
        <form id="createFolderForm">
            <input type="text" id="folderNameInput" placeholder="Folder Name" required>
            <button type="submit">Create</button>
        </form>
    </div>
</div>

<div id="previewModal" class="modal">
    <div class="modal-content wide">
        <span class="close-modal">&times;</span>
        <div id="previewContainer"></div>
    </div>
</div>
`;

// --- Router ---
function renderPage(page) {
    const appContainer = document.getElementById('app');
    if (page === 'login') {
        appContainer.innerHTML = loginPageTemplate;
        document.getElementById('loginForm').addEventListener('submit', handleLogin);
    } else if (page === 'setup') {
        appContainer.innerHTML = setupPageTemplate;
        document.getElementById('setupForm').addEventListener('submit', handleSetup);
    } else if (page === 'dashboard') {
        appContainer.innerHTML = dashboardPageTemplate;
        setupDashboardListeners();
        loadStorage();
        loadFiles(); // Initial load of root directory
    }
}

// --- Authentication ---
async function checkAuth() {
    const userJson = localStorage.getItem('haziUser');
    if (!userJson) {
        // Check if the system is already initialized
        try {
            const res = await fetch(`${API_URL}/register`); // This will fail if the system is initialized
            if (res.status === 403) {
                renderPage('login');
            } else {
                renderPage('setup');
            }
        } catch (error) {
            renderPage('login');
        }
    } else {
        renderPage('dashboard');
        const user = JSON.parse(userJson);
        const greeting = document.getElementById('user-greeting');
        if(greeting) greeting.innerText = `Hello, ${user.username}`;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (data.success) {
            localStorage.setItem('haziUser', JSON.stringify(data.user));
            window.location.reload(); // Reload to re-trigger checkAuth and render the dashboard
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Login failed. Please check your connection.');
    }
}

async function handleSetup(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            window.location.reload(); // Reload to go to the login page
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Setup failed. Please check your connection.');
    }
}

function logout() {
    localStorage.removeItem('haziUser');
    window.location.reload();
}

// --- UI Interaction ---
function setupDashboardListeners() {
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Modal triggers
    document.getElementById('upload-btn').addEventListener('click', () => openModal('uploadModal'));
    document.getElementById('create-folder-btn').addEventListener('click', () => openModal('createFolderModal'));

    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal').id));
    });

    // Modal background close
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
    
    // Form submissions
    document.getElementById('createFolderForm').addEventListener('submit', handleCreateFolder);
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
    // Reset forms inside modals
    const form = modal.querySelector('form');
    if (form) form.reset();
    // Reset upload progress
    const uploadProgress = document.getElementById('uploadProgress');
    if (uploadProgress) {
        uploadProgress.style.display = 'none';
        document.getElementById('uploadBar').style.width = '0%';
    }
}

// --- Storage Metrics ---
async function loadStorage() {
    const storageFill = document.getElementById('storage-fill');
    const storageText = document.getElementById('storage-text');
    if (!storageFill || !storageText) return;

    try {
        const res = await fetch(`${API_URL}/storage`);
        const disks = await res.json();
        if (disks.length > 0) {
            const mainDisk = disks[0]; // Assuming the first disk is the primary one
            const percent = parseInt(mainDisk.percent);
            storageFill.style.width = `${percent}%`;
            if (percent > 90) {
                storageFill.style.backgroundColor = '#e74c3c'; // Red for almost full
            } else if (percent > 70) {
                storageFill.style.backgroundColor = '#f39c12'; // Orange for warning
            }
            storageText.innerText = `${mainDisk.used} / ${mainDisk.size} (${mainDisk.percent})`;
        }
    } catch (e) {
        storageText.innerText = 'Error loading storage data.';
        console.error('Storage loading error:', e);
    }
}

// --- File & Folder Logic ---
async function loadFiles(path = '') {
    currentPath = path;
    const fileGrid = document.getElementById('file-grid');
    fileGrid.innerHTML = '<div class="loading-spinner"></div>'; // Show spinner

    try {
        const res = await fetch(`${API_URL}/files?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const files = await res.json();

        fileGrid.innerHTML = ''; // Clear spinner
        updateBreadcrumb();

        if (files.length === 0) {
            fileGrid.innerHTML = '<p class="empty-folder-text">This folder is empty</p>';
            return;
        }

        files.sort((a, b) => {
            if (a.isDir !== b.isDir) {
                return a.isDir ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.setAttribute('data-name', file.name);
            fileItem.setAttribute('data-is-dir', file.isDir);

            fileItem.innerHTML = createFileIcon(file) + 
                               `<div class="file-name">${file.name}</div>` + 
                               createActionMenu(file);

            if (file.isDir) {
                fileItem.addEventListener('click', (e) => {
                    if (!e.target.closest('.action-menu')) {
                        const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
                        loadFiles(newPath);
                    }
                });
            }

            fileGrid.appendChild(fileItem);
        });
    } catch (e) {
        fileGrid.innerHTML = '<p class="error-text">Failed to load files. Please try again.</p>';
        console.error('File loading error:', e);
    }
}

function createFileIcon(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const previewPath = `/uploads/${currentPath ? currentPath + '/' : ''}${file.name}`;

    if (file.isDir) {
        return '<div class="file-icon folder"><i class="fas fa-folder"></i></div>';
    }
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
        return `<div class="file-icon thumbnail" style="background-image: url('${previewPath}')"></div>`;
    }
    if (['mp4', 'mov', 'webm'].includes(ext)) {
        return '<div class="file-icon video"><i class="fas fa-file-video"></i></div>';
    }
    if (ext === 'pdf') {
        return '<div class="file-icon pdf"><i class="fas fa-file-pdf"></i></div>';
    }
    return '<div class="file-icon generic"><i class="fas fa-file-alt"></i></div>';
}

function createActionMenu(file) {
    const fullPath = `${currentPath ? currentPath + '/' : ''}${file.name}`;
    const menu = `
        <div class="action-menu">
            <button class="menu-toggle-btn"><i class="fas fa-ellipsis-v"></i></button>
            <div class="menu-dropdown">
                ${!file.isDir ? `<a href="#" onclick="previewFile('${fullPath}')"><i class="fas fa-eye"></i> Preview</a>` : ''}
                ${!file.isDir ? `<a href="/uploads/${fullPath}" download><i class="fas fa-download"></i> Download</a>` : ''}
                <a href="#" onclick="deleteItem('${file.name}', ${file.isDir})"><i class="fas fa-trash"></i> Delete</a>
            </div>
        </div>';
    return menu;
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '';
    const parts = currentPath.split('/').filter(p => p);

    const homeLink = document.createElement('a');
    homeLink.href = '#';
    homeLink.innerText = 'Home';
    homeLink.onclick = (e) => { e.preventDefault(); loadFiles(''); };
    breadcrumb.appendChild(homeLink);

    let path = '';
    parts.forEach(part => {
        path += (path ? '/' : '') + part;
        const separator = document.createElement('span');
        separator.className = 'separator';
        separator.innerText = '/';
        breadcrumb.appendChild(separator);

        const partLink = document.createElement('a');
        partLink.href = '#';
        partLink.innerText = part;
        const currentPartPath = path;
        partLink.onclick = (e) => { e.preventDefault(); loadFiles(currentPartPath); };
        breadcrumb.appendChild(partLink);
    });
}

// --- Form Handlers ---
async function handleCreateFolder(e) {
    e.preventDefault();
    const input = document.getElementById('folderNameInput');
    const folderName = input.value.trim();
    if (!folderName) return;

    try {
        const res = await fetch(`${API_URL}/create-folder`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ folderName: `${currentPath ? currentPath + '/' : ''}${folderName}` })
        });
        if (res.ok) {
            closeModal('createFolderModal');
            loadFiles(currentPath);
        } else {
            const data = await res.json();
            alert('Error: ' + (data.error || 'Could not create folder.'));
        }
    } catch (err) {
        alert('Request failed. Please check your connection.');
    }
}

async function handleUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    if (files.length === 0) return;

    const formData = new FormData();
    for (const file of files) {
        formData.append('file', file);
    }
    formData.append('path', currentPath);

    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadBar');
    const statusText = document.getElementById('uploadStatus');

    progressDiv.style.display = 'block';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/upload`, true);
    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            progressBar.style.width = percent + '%';
            statusText.innerText = `Uploading... ${Math.round(percent)}%`;
        }
    };
    xhr.onload = () => {
        if (xhr.status === 200) {
            closeModal('uploadModal');
            loadFiles(currentPath);
        } else {
            statusText.innerText = 'Upload Failed.';
            try {
                const result = JSON.parse(xhr.responseText);
                alert('Error: ' + (result.error || 'Server error'));
            } catch (err) {
                alert('An unknown error occurred.');
            }
        }
    };
    xhr.onerror = () => {
        statusText.innerText = 'Network Error.';
        alert('Upload failed due to a network error.');
    };
    xhr.send(formData);
}

async function deleteItem(name, isDir) {
    const type = isDir ? 'folder' : 'file';
    if (!confirm(`Are you sure you want to delete the ${type} "${name}"? This cannot be undone.`)) return;

    try {
        const res = await fetch(`${API_URL}/delete`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ filename: `${currentPath ? currentPath + '/' : ''}${name}` })
        });
        if (res.ok) {
            loadFiles(currentPath);
        } else {
            const data = await res.json();
            alert(`Delete failed: ${data.error}`);
        }
    } catch (e) {
        alert('Connection error while trying to delete.');
    }
}

// --- Preview --- 
function previewFile(fullPath) {
    const modal = document.getElementById('previewModal');
    const container = document.getElementById('previewContainer');
    const path = `/uploads/${fullPath}`;
    const ext = fullPath.split('.').pop().toLowerCase();
    
    let content = '';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
        content = `<img src="${path}" alt="${fullPath}">`;
    } else if (['mp4', 'webm'].includes(ext)) {
        content = `<video src="${path}" controls autoplay></video>`;
    } else if (ext === 'pdf') {
        content = `<iframe src="${path}"></iframe>`;
    } else {
        content = '<p>No preview available for this file type.</p>';
    }
    
    container.innerHTML = content;
    openModal('previewModal');
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

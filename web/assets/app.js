const API_URL = '/api';
let currentPath = "";
let selectedItem = null; // Untuk Context Menu
let userToken = localStorage.getItem('haziToken');

// --- AUTH & INIT ---
function checkAuth() {
    if (!userToken) window.location.href = 'index.html';
}

// Headers Helper
const getHeaders = () => ({ 'Authorization': userToken, 'Content-Type': 'application/json' });

// --- CORE FUNCTIONS ---

async function loadSystemStats() {
    try {
        const res = await fetch(`${API_URL}/sys-stats`, { headers: { 'Authorization': userToken } });
        if(res.status === 401) return logout();
        const data = await res.json();
        
        document.getElementById('cpu-val').innerText = data.cpu;
        document.getElementById('ram-val').innerText = data.memUsed;
        
        // Handle Storage
        if(data.storage && data.storage.length > 0) {
            const disk = data.storage[0]; // Ambil disk pertama dulu
            document.getElementById('disk-val').innerText = `${disk.used} / ${disk.size}`;
            document.getElementById('disk-bar').style.width = disk.percent;
            document.getElementById('disk-name').innerText = disk.mount;
        }
    } catch(e) { console.error(e); }
}

async function loadFiles(path = "") {
    currentPath = path;
    document.getElementById('path-display').innerText = path ? `/${path}` : '/Home';
    const container = document.getElementById('file-container');
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#666">Loading...</div>';

    try {
        const res = await fetch(`${API_URL}/files?path=${encodeURIComponent(path)}`, { headers: { 'Authorization': userToken } });
        const files = await res.json();
        
        container.innerHTML = '';
        if(files.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#444"><i class="fa-regular fa-folder-open" style="font-size:2rem; margin-bottom:10px"></i><br>Empty Folder</div>';
            return;
        }

        files.forEach(file => {
            const isImg = ['.jpg','.jpeg','.png','.gif','.webp'].includes(file.type);
            const isPdf = file.type === '.pdf';
            const iconClass = file.isDir ? 'fa-folder' : isPdf ? 'fa-file-pdf' : isImg ? 'fa-image' : 'fa-file';
            const itemClass = file.isDir ? 'is-dir' : isPdf ? 'is-pdf' : '';
            
            // Logic Thumbnail
            let thumbContent = `<i class="fa-solid ${iconClass}"></i>`;
            if(isImg && !file.isDir) {
                // Construct URL gambar langsung
                const imgUrl = `/uploads/${path ? path + '/' : ''}${file.name}`;
                thumbContent = `<img src="${imgUrl}" loading="lazy">`;
            }

            const div = document.createElement('div');
            div.className = `file-item ${itemClass}`;
            div.innerHTML = `
                <div class="file-thumb">${thumbContent}</div>
                <div class="file-meta">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${file.size}</div>
                </div>
                <div onclick="openMenu(event, '${file.name}', ${file.isDir})" style="padding:10px"><i class="fa-solid fa-ellipsis-vertical"></i></div>
            `;

            // Click: Buka Folder / Preview File
            div.onclick = (e) => {
                // Jangan trigger jika yang diklik adalah tombol menu titik tiga
                if(e.target.closest('.fa-ellipsis-vertical')) return;
                
                if(file.isDir) {
                    loadFiles(path ? `${path}/${file.name}` : file.name);
                } else {
                    previewFile(file.name);
                }
            };

            // Long Press untuk Mobile (Context Menu)
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                openMenu(e, file.name, file.isDir);
            });

            container.appendChild(div);
        });
    } catch(e) { console.error(e); }
}

// --- ACTIONS ---

async function uploadFile() {
    const input = document.getElementById('hidden-upload');
    input.click();
    
    input.onchange = async () => {
        const file = input.files[0];
        if(!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);

        const btn = document.querySelector('.fab-add');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            await fetch(`${API_URL}/upload`, { 
                method: 'POST', 
                headers: { 'Authorization': userToken },
                body: formData 
            });
            loadFiles(currentPath);
        } catch(e) { alert("Upload Failed"); }
        finally { btn.innerHTML = '<i class="fa-solid fa-plus"></i>'; input.value=''; }
    };
}

async function createFolder() {
    const name = prompt("Folder Name:");
    if(!name) return;
    
    // Path Relatif Penuh
    const fullPath = currentPath ? `${currentPath}/${name}` : name;
    
    await fetch(`${API_URL}/create-folder`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ folderName: fullPath })
    });
    loadFiles(currentPath);
}

// --- CONTEXT MENU LOGIC ---
const ctxMenu = document.getElementById('ctx-menu');

function openMenu(e, name, isDir) {
    e.preventDefault();
    e.stopPropagation();
    selectedItem = { name, isDir, fullPath: currentPath ? `${currentPath}/${name}` : name };
    
    // Posisi Menu
    let x = e.clientX; 
    let y = e.clientY;
    
    // Fix overflow di layar HP
    if(x + 180 > window.innerWidth) x = window.innerWidth - 190;
    
    ctxMenu.style.top = `${y}px`;
    ctxMenu.style.left = `${x}px`;
    ctxMenu.classList.remove('hidden');
}

// Tutup menu kalau klik di tempat lain
document.addEventListener('click', () => ctxMenu.classList.add('hidden'));

// Aksi Menu
async function menuAction(action) {
    if(!selectedItem) return;
    
    if(action === 'download') {
        const link = document.createElement('a');
        link.href = `/uploads/${selectedItem.fullPath}`;
        link.download = selectedItem.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    if(action === 'rename') {
        const newName = prompt("Rename to:", selectedItem.name);
        if(newName && newName !== selectedItem.name) {
            await fetch(`${API_URL}/rename`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ oldPath: selectedItem.fullPath, newName })
            });
            loadFiles(currentPath);
        }
    }
    
    if(action === 'delete') {
        if(confirm(`Delete ${selectedItem.name}?`)) {
            await fetch(`${API_URL}/delete`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ target: selectedItem.fullPath })
            });
            loadFiles(currentPath);
        }
    }
    ctxMenu.classList.add('hidden');
}

// --- NAVIGASI ---
function goUp() {
    if(!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    loadFiles(parts.join('/'));
}

function logout() {
    localStorage.removeItem('haziToken');
    window.location.href = 'index.html';
}

function previewFile(name) {
    const url = `/uploads/${currentPath ? currentPath + '/' : ''}${name}`;
    window.open(url, '_blank');
}

// --- AUTO RUN ---
if(window.location.pathname.includes('dashboard')) {
    checkAuth();
    loadSystemStats();
    loadFiles();
    setInterval(loadSystemStats, 10000); // Auto refresh stats
            }


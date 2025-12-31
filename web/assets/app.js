
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
            const disk = data.storage[0]; // Ambil disk pertama
            document.getElementById('disk-val').innerText = `${disk.used} / ${disk.size}`;
            document.getElementById('disk-bar').style.width = disk.percent;
            document.getElementById('disk-name').innerText = disk.mount;
        }
    } catch(e) { console.error(e); }
}

async function loadFiles(path = "") {
    currentPath = path;
    const displayPath = path ? `/${path}` : '/Home';
    document.getElementById('path-display').innerText = displayPath;
    
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
                <div onclick="openMenu(event, '${file.name}', ${file.isDir})" style="padding:10px; cursor: pointer;"><i class="fa-solid fa-ellipsis-vertical"></i></div>
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

            // Long Press untuk Mobile / Klik Kanan (Context Menu)
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
    input.value = ''; // Reset agar bisa pilih file yang sama
    input.click();
    
    input.onchange = async () => {
        const file = input.files[0];
        if(!file) return;

        const formData = new FormData();
        // [FIX] Masukkan Path DULUAN sebelum File agar terbaca oleh Multer
        formData.append('path', currentPath); 
        formData.append('file', file);

        const btn = document.querySelector('.fab-add');
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; // Loading

        try {
            const res = await fetch(`${API_URL}/upload`, { 
                method: 'POST', 
                headers: { 'Authorization': userToken },
                body: formData 
            });
            
            if(res.ok) {
                loadFiles(currentPath); // Refresh folder saat ini
            } else {
                alert("Upload Failed");
            }
        } catch(e) { 
            alert("Network Error during upload"); 
        }
        finally { 
            btn.innerHTML = originalIcon; // Balikin icon
            input.value = ''; 
        }
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
    
    // Fix overflow di layar HP (supaya menu gak kepotong)
    if(x + 180 > window.innerWidth) x = window.innerWidth - 190;
    if(y + 150 > window.innerHeight) y = window.innerHeight - 160;
    
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
        // Trigger download via link hidden
        const link = document.createElement('a');
        link.href = `/uploads/${selectedItem.fullPath}`;
        link.setAttribute('download', selectedItem.name); // Paksa atribut download
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
        if(confirm(`Permanently delete ${selectedItem.name}?`)) {
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
    if(!currentPath) return; // Sudah di root
    const parts = currentPath.split('/');
    parts.pop(); // Buang folder terakhir
    loadFiles(parts.join('/'));
}

function logout() {
    if(confirm("Logout from system?")) {
        localStorage.removeItem('haziToken');
        window.location.href = 'index.html';
    }
}

function previewFile(name) {
    const url = `/uploads/${currentPath ? currentPath + '/' : ''}${name}`;
    window.open(url, '_blank');
}

// --- AUTO RUN ---
// Cek jika kita berada di dashboard
if(window.location.pathname.endsWith('dashboard.html') || window.location.pathname.endsWith('dashboard')) {
    checkAuth();
    loadSystemStats();
    loadFiles(); // Load root saat pertama buka
    setInterval(loadSystemStats, 10000); // Auto refresh stats
                }
                      

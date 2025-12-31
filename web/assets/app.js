const API_URL = '/api';
let currentPath = "";
let selectedItem = null;
let userToken = localStorage.getItem('haziToken');

let isSelectionMode = false;
let selectedFiles = [];

function checkAuth() { if (!userToken) window.location.href = 'index.html'; }
const getHeaders = () => ({ 'Authorization': userToken, 'Content-Type': 'application/json' });

async function loadSystemStats() {
    try {
        const res = await fetch(`${API_URL}/sys-stats`, { headers: { 'Authorization': userToken } });
        if(res.status === 401) return logout();
        const data = await res.json();
        document.getElementById('cpu-val').innerText = data.cpu;
        document.getElementById('ram-val').innerText = data.memUsed;
        const activeRes = await fetch(`${API_URL}/active-storage`, { headers: { 'Authorization': userToken } });
        const activeData = await activeRes.json();
        const activeDisk = data.storage.find(d => activeData.path.startsWith(d.mount)) || data.storage[0];
        if(activeDisk) {
            document.getElementById('disk-val').innerText = `${activeDisk.used} / ${activeDisk.size}`;
            document.getElementById('disk-bar').style.width = activeDisk.percent;
            document.getElementById('disk-name').innerText = activeDisk.mount;
        }
    } catch(e) { console.error(e); }
}

async function loadFiles(path = "") {
    exitSelectionMode();
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
            
            let thumbContent = `<i class="fa-solid ${iconClass}"></i>`;
            if(isImg && !file.isDir) {
                const imgUrl = `/uploads/${path ? path + '/' : ''}${file.name}`;
                thumbContent = `<img src="${imgUrl}" loading="lazy">`;
            }

            const div = document.createElement('div');
            div.className = `file-item ${itemClass}`;
            div.dataset.name = file.name;
            div.innerHTML = `
                <div class="file-thumb">${thumbContent}</div>
                <div class="file-meta"><div class="file-name">${file.name}</div><div class="file-size">${file.size}</div></div>
                <div class="file-opt" style="padding:10px; cursor:pointer"><i class="fa-solid fa-ellipsis-vertical"></i></div>
            `;

            div.onclick = (e) => {
                if(isSelectionMode) toggleSelection(div, file.name);
                else {
                    if(e.target.closest('.file-opt')) return openMenu(e, file.name, file.isDir);
                    if(file.isDir) loadFiles(path ? `${path}/${file.name}` : file.name);
                    else previewFile(file.name);
                }
            };
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if(!isSelectionMode) { enterSelectionMode(); toggleSelection(div, file.name); }
                else openMenu(e, file.name, file.isDir);
            });
            container.appendChild(div);
        });
    } catch(e) { console.error(e); }
}

function enterSelectionMode() {
    isSelectionMode = true;
    document.body.classList.add('selecting');
    document.getElementById('bulk-bar').classList.add('active');
    document.querySelector('.fab-add').classList.add('hidden');
    document.querySelector('.bottom-nav').classList.add('hidden');
}
function exitSelectionMode() {
    isSelectionMode = false; selectedFiles = [];
    document.body.classList.remove('selecting');
    document.getElementById('bulk-bar').classList.remove('active');
    document.querySelector('.fab-add').classList.remove('hidden');
    document.querySelector('.bottom-nav').classList.remove('hidden');
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
    updateBulkUI();
}
function toggleSelection(el, fileName) {
    const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
    if(selectedFiles.includes(fullPath)) {
        selectedFiles = selectedFiles.filter(f => f !== fullPath);
        el.classList.remove('selected');
    } else {
        selectedFiles.push(fullPath);
        el.classList.add('selected');
    }
    if(selectedFiles.length === 0) exitSelectionMode(); else updateBulkUI();
}
function selectAll() {
    document.querySelectorAll('.file-item').forEach(el => {
        const fullPath = currentPath ? `${currentPath}/${el.dataset.name}` : el.dataset.name;
        if(!selectedFiles.includes(fullPath)) { selectedFiles.push(fullPath); el.classList.add('selected'); }
    });
    updateBulkUI();
}
function updateBulkUI() { document.getElementById('selected-count').innerText = selectedFiles.length; }

async function bulkDelete() {
    if(!confirm(`Delete ${selectedFiles.length} items?`)) return;
    await fetch(`${API_URL}/bulk-delete`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ targets: selectedFiles }) });
    loadFiles(currentPath);
}
async function bulkDownload() {
    if(selectedFiles.length > 5 && !confirm("Download multiple files?")) return;
    selectedFiles.forEach((path, i) => setTimeout(() => {
        const link = document.createElement('a'); link.href = `/uploads/${path}`; link.setAttribute('download', path.split('/').pop());
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }, i * 500));
}

async function uploadFile() {
    const input = document.getElementById('hidden-upload');
    input.value = ''; input.click();
    input.onchange = () => {
        const files = input.files; if(files.length === 0) return;
        const modal = document.getElementById('upload-modal');
        const bar = document.getElementById('upload-bar');
        const percentTxt = document.getElementById('upload-percent');
        const nameTxt = document.getElementById('upload-filename');
        modal.classList.remove('hidden');
        nameTxt.innerText = files.length > 1 ? `${files.length} Files...` : files[0].name;
        bar.style.width = '0%';
        const formData = new FormData();
        formData.append('path', currentPath);
        for (let i = 0; i < files.length; i++) formData.append('files', files[i]);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/upload`, true);
        xhr.setRequestHeader('Authorization', userToken);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                bar.style.width = percent + '%'; percentTxt.innerText = percent + '%';
            }
        };
        xhr.onload = () => { modal.classList.add('hidden'); if (xhr.status === 200) loadFiles(currentPath); else alert("Failed"); };
        xhr.onerror = () => { modal.classList.add('hidden'); alert("Error"); };
        xhr.send(formData);
    };
}

async function openStorageSettings() {
    const modal = document.getElementById('storage-modal');
    const list = document.getElementById('storage-list');
    modal.classList.remove('hidden'); list.innerHTML = '<p>Scanning...</p>';
    try {
        const res = await fetch(`${API_URL}/sys-stats`, { headers: {'Authorization': userToken} });
        const data = await res.json();
        const activeRes = await fetch(`${API_URL}/active-storage`, { headers: {'Authorization': userToken} });
        const activeData = await activeRes.json();
        list.innerHTML = '';
        data.storage.forEach(disk => {
            const isActive = activeData.path.startsWith(disk.mount);
            const border = isActive ? '2px solid var(--primary)' : '1px solid var(--border)';
            const div = document.createElement('div');
            div.style.cssText = `background:var(--bg-deep); border:${border}; padding:10px; border-radius:8px; cursor:pointer;`;
            div.innerHTML = `<div style="display:flex; justify-content:space-between; font-weight:bold; color:var(--text-main)">${disk.mount} ${isActive ? '<i class="fa-solid fa-check" style="color:var(--primary)"></i>' : ''}</div><div style="font-size:0.8rem; color:#888; margin-top:5px;">Size: ${disk.size} | Free: ${disk.avail}</div>`;
            if(!isActive) div.onclick = () => { if(confirm(`Switch to ${disk.mount}?`)) setStorage(disk.mount); };
            list.appendChild(div);
        });
    } catch(e) { console.error(e); }
}
async function setStorage(path) {
    await fetch(`${API_URL}/set-storage`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ newPath: path }) });
    document.getElementById('storage-modal').classList.add('hidden'); loadFiles(''); loadSystemStats();
}

async function createFolder() {
    const name = prompt("Folder Name:"); if(!name) return;
    const fullPath = currentPath ? `${currentPath}/${name}` : name;
    await fetch(`${API_URL}/create-folder`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ folderName: fullPath }) });
    loadFiles(currentPath);
}

const ctxMenu = document.getElementById('ctx-menu');
function openMenu(e, name, isDir) {
    e.preventDefault(); e.stopPropagation();
    selectedItem = { name, isDir, fullPath: currentPath ? `${currentPath}/${name}` : name };
    let x = e.clientX, y = e.clientY;
    if(x + 180 > window.innerWidth) x = window.innerWidth - 190;
    if(y + 150 > window.innerHeight) y = window.innerHeight - 160;
    ctxMenu.style.top = `${y}px`; ctxMenu.style.left = `${x}px`;
    ctxMenu.classList.remove('hidden');
}
document.addEventListener('click', () => ctxMenu.classList.add('hidden'));
async function menuAction(action) {
    if(!selectedItem) return;
    if(action === 'download') { const link = document.createElement('a'); link.href = `/uploads/${selectedItem.fullPath}`; link.setAttribute('download', selectedItem.name); document.body.appendChild(link); link.click(); document.body.removeChild(link); }
    if(action === 'rename') { const newName = prompt("Rename:", selectedItem.name); if(newName) { await fetch(`${API_URL}/rename`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ oldPath: selectedItem.fullPath, newName }) }); loadFiles(currentPath); } }
    if(action === 'delete') { if(confirm(`Delete ${selectedItem.name}?`)) { await fetch(`${API_URL}/delete`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ target: selectedItem.fullPath }) }); loadFiles(currentPath); } }
    ctxMenu.classList.add('hidden');
}
function goUp() { if(!currentPath) return; const parts = currentPath.split('/'); parts.pop(); loadFiles(parts.join('/')); }
function logout() { if(confirm("Logout?")) { localStorage.removeItem('haziToken'); window.location.href = 'index.html'; } }
function previewFile(name) { window.open(`/uploads/${currentPath ? currentPath + '/' : ''}${name}`, '_blank'); }

if(window.location.pathname.includes('dashboard')) { checkAuth(); loadSystemStats(); loadFiles(); setInterval(loadSystemStats, 10000); }

const API_URL = '/api';

// Auth Check
function checkAuth() {
    const user = localStorage.getItem('haziUser');
    if (!user) window.location.href = '/';
    else document.getElementById('user-display').innerText = `OPERATOR: ${JSON.parse(user).username.toUpperCase()}`;
}

function logout() {
    localStorage.removeItem('haziUser');
    window.location.href = '/';
}

// Storage Logic
async function loadStorage() {
    try {
        const res = await fetch(`${API_URL}/storage`);
        const disks = await res.json();
        const container = document.getElementById('storage-container');
        container.innerHTML = '<h3>STORAGE_METRICS</h3><hr style="border:0; border-top:1px solid #333; margin:10px 0">';
        
        disks.forEach(disk => {
            container.innerHTML += `
                <div style="margin-bottom: 15px;">
                    <small>${disk.mount} [${disk.filesystem}]</small>
                    <div class="storage-bar">
                        <div class="storage-fill" style="width: ${disk.percent}"></div>
                    </div>
                    <small style="color: var(--accent);">${disk.used} / ${disk.size} (${disk.percent})</small>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

// File Logic
async function loadFiles() {
    const res = await fetch(`${API_URL}/files`);
    const files = await res.json();
    const tbody = document.getElementById('fileList');
    tbody.innerHTML = '';

    files.forEach(file => {
        const isPreviewable = ['.jpg', '.png', '.mp4', '.pdf'].includes(file.type);
        
        tbody.innerHTML += `
            <tr>
                <td>${file.name}</td>
                <td>${file.size}</td>
                <td>${file.type}</td>
                <td>
                    <button class="btn-sm" onclick="downloadFile('${file.name}')">DL</button>
                    ${isPreviewable ? `<button class="btn-sm" onclick="previewFile('${file.name}', '${file.type}')">VIEW</button>` : ''}
                    <button class="btn-sm" style="background:red; color:white" onclick="deleteFile('${file.name}')">DEL</button>
                </td>
            </tr>
        `;
    });
}

// Upload
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('file', document.getElementById('fileInput').files[0]);
    document.getElementById('uploadStatus').innerText = "Uploading...";

    try {
        await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
        document.getElementById('uploadStatus').innerText = "Upload Complete.";
        loadFiles();
        document.getElementById('fileInput').value = '';
    } catch (e) { alert("Upload Failed"); }
});

function downloadFile(name) {
    window.location.href = `/uploads/${name}`;
}

async function deleteFile(name) {
    if(confirm('CONFIRM DELETE?')) {
        await fetch(`${API_URL}/delete`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({filename: name})
        });
        loadFiles();
    }
}

// Preview Logic
function previewFile(name, type) {
    const modal = document.getElementById('previewModal');
    const container = document.getElementById('previewContainer');
    modal.style.display = 'flex';
    container.innerHTML = '';

    const path = `/uploads/${name}`;
    if (type === '.jpg' || type === '.png') {
        container.innerHTML = `<img src="${path}" style="max-width:80vw; max-height:80vh; border: 1px solid var(--accent);">`;
    } else if (type === '.mp4') {
        container.innerHTML = `<video controls src="${path}" style="max-width:80vw; max-height:80vh;"></video>`;
    } else if (type === '.pdf') {
        container.innerHTML = `<iframe src="${path}" style="width:80vw; height:80vh;"></iframe>`;
    }
}

function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
    document.getElementById('previewContainer').innerHTML = '';
}

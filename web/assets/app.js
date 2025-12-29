const API_URL = '/api';

// --- Auth Logic ---
function checkAuth() {
    const userJson = localStorage.getItem('haziUser');
    if (!userJson) {
        window.location.href = '/';
        return;
    }
    try {
        const user = JSON.parse(userJson);
        document.getElementById('user-display').innerText = `OPERATOR: ${user.username.toUpperCase()}`;
    } catch (e) { logout(); }
}

function logout() {
    localStorage.removeItem('haziUser');
    window.location.href = '/';
}

// --- UI Helpers ---
function showToast(msg, isError = false) {
    // Implementasi toast sederhana (bisa dipercantik nanti)
    alert(msg); 
}

// --- Storage Logic ---
async function loadStorage() {
    const container = document.getElementById('storage-container');
    try {
        const res = await fetch(`${API_URL}/storage`);
        const disks = await res.json();
        
        if(disks.length === 0) {
            container.innerHTML = '<small style="color:red">NO STORAGE DETECTED</small>';
            return;
        }

        let html = '<h3>STORAGE_METRICS</h3><hr style="border:0; border-top:1px solid var(--border); margin:10px 0">';
        disks.forEach(disk => {
            // Warna bar berubah merah jika penuh > 90%
            const barColor = parseInt(disk.percent) > 90 ? 'background: linear-gradient(90deg, #ff4444, #ff0000);' : '';
            
            html += `
                <div style="margin-bottom: 20px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem">
                        <span style="color: var(--accent)">${disk.mount}</span>
                        <span>${disk.filesystem}</span>
                    </div>
                    <div class="storage-bar">
                        <div class="storage-fill" style="width: ${disk.percent}; ${barColor}"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-top:5px;">
                        <span>Used: ${disk.used}</span>
                        <span style="color: var(--accent); font-weight:bold">${disk.percent}</span>
                        <span>Free: ${disk.avail}</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) { 
        console.error(e);
        container.innerHTML = '<small style="color:red">SENSOR ERROR</small>';
    }
}

// --- File Logic ---
async function loadFiles() {
    const tbody = document.getElementById('fileList');
    try {
        const res = await fetch(`${API_URL}/files`);
        if(!res.ok) throw new Error("Failed to fetch files");
        const files = await res.json();
        
        tbody.innerHTML = '';

        if(files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; opacity:0.5">>> NO DATA FOUND <<</td></tr>';
            return;
        }

        files.forEach(file => {
            const isPreviewable = !file.isDir && ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.pdf'].includes(file.type);
            const rowClass = file.isDir ? 'dir-row' : '';
            const icon = file.isDir ? '[DIR]' : '[FILE]';

            tbody.innerHTML += `
                <tr class="${rowClass}">
                    <td><span class="icon-type">${icon}</span> ${file.name}</td>
                    <td>${file.size}</td>
                    <td>${file.type.replace('.', '').toUpperCase()}</td>
                    <td>
                        <div class="action-buttons">
                            ${!file.isDir ? `<button class="btn-sm" onclick="downloadFile('${file.name}')">DL</button>` : ''}
                            ${isPreviewable ? `<button class="btn-sm" onclick="previewFile('${file.name}', '${file.type}')">VIEW</button>` : ''}
                            <button class="btn-sm btn-del" onclick="deleteFile('${file.name}', ${file.isDir})">DEL</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red">CONNECTION LOST</td></tr>';
    }
}

// --- ACTIONS ---

// 1. Create Folder
document.getElementById('createFolderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('folderNameInput');
    const folderName = input.value.trim();
    if(!folderName) return;

    try {
        const res = await fetch(`${API_URL}/create-folder`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ folderName })
        });
        const data = await res.json();
        
        if(res.ok) {
            input.value = ''; // Clear input
            loadFiles(); // Refresh list
            showToast(data.message);
        } else {
            showToast("Error: " + data.error, true);
        }
    } catch (e) { showToast("Request Failed", true); }
});


// 2. Upload File (dengan progress bar visual sederhana)
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    // UI elements
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadBar');
    const statusText = document.getElementById('uploadStatus');
    
    progressDiv.style.display = 'block';
    progressBar.style.width = '0%';
    statusText.innerText = `INITIATING UPLOAD: ${file.name}...`;

    // Menggunakan XMLHttpRequest untuk tracking progress upload
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/upload`, true);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            progressBar.style.width = percentComplete + '%';
            statusText.innerText = `UPLOADING... ${Math.round(percentComplete)}%`;
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            statusText.innerText = "UPLOAD COMPLETE.";
            progressBar.style.background = "#00ff00"; // Hijau
            setTimeout(() => {
                progressDiv.style.display = 'none';
                progressBar.style.width = '0%';
                progressBar.style.background = ""; // Reset warna
                fileInput.value = '';
                loadFiles();
            }, 2000);
        } else {
            statusText.innerText = "UPLOAD FAILED.";
            progressBar.style.background = "red";
        }
    };

    xhr.onerror = () => {
        statusText.innerText = "NETWORK ERROR.";
        progressBar.style.background = "red";
    };

    xhr.send(formData);
});

function downloadFile(name) {
    // Trigger download browser
    const link = document.createElement('a');
    link.href = `/uploads/${name}`;
    link.download = name; // Hint untuk browser agar mendownload
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function deleteFile(name, isDir) {
    const typeMsg = isDir ? "DIRECTORY (Must be empty)" : "FILE";
    if(!confirm(`CONFIRM DELETE ${typeMsg}: ${name}? THIS CANNOT BE UNDONE.`)) return;

    try {
        const res = await fetch(`${API_URL}/delete`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({filename: name})
        });
        const data = await res.json();
        if(res.ok) {
            loadFiles();
        } else {
            showToast("Delete Failed: " + data.error, true);
        }
    } catch(e) { showToast("Connection Error", true); }
}

// --- Preview Logic ---
function previewFile(name, type) {
    const modal = document.getElementById('previewModal');
    const container = document.getElementById('previewContainer');
    const path = `/uploads/${name}`;
    
    container.innerHTML = '<span style="color:var(--accent)">LOADING STREAM...</span>';
    modal.style.display = 'flex';

    setTimeout(() => {
        let content = '';
        const ext = type.toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
            content = `<img src="${path}">`;
        } else if (ext === '.mp4') {
            content = `<video controls autoplay src="${path}"></video>`;
        } else if (ext === '.pdf') {
            // PDF di mobile lebih baik di-download atau buka di tab baru, 
            // tapi untuk desktop iframe oke.
             if(window.innerWidth < 768) {
                 content = `<a href="${path}" target="_blank" class="btn-sm" style="padding:20px; text-decoration:none">OPEN PDF IN NEW TAB</a>`;
             } else {
                 content = `<iframe src="${path}" style="width:80vw; height:80vh; border:1px solid var(--accent)"></iframe>`;
             }
        } else {
             content = `<span style="color:red">PREVIEW NOT AVAILABLE FOR THIS TYPE</span>`;
        }
        container.innerHTML = content;
    }, 500);
}

function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
    document.getElementById('previewContainer').innerHTML = '';
                                                                              }
            

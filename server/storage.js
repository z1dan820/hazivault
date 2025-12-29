const { exec } = require('child_process');

const getStorageInfo = () => {
    return new Promise((resolve, reject) => {
        // Perintah Linux standard untuk cek disk
        exec('df -h --output=source,size,used,avail,pcent,target', (error, stdout, stderr) => {
            if (error) {
                console.error(`Storage Error: ${error}`);
                return resolve([]); // Return kosong agar tidak crash
            }

            const lines = stdout.trim().split('\n');
            const disks = [];

            // Skip header
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].trim().split(/\s+/);
                if (parts.length >= 6) {
                    const mount = parts[5];
                    // Filter hanya mount point relevan untuk NAS
                    if (mount === '/' || mount.startsWith('/mnt') || mount.startsWith('/media') || mount.includes('storage')) {
                        disks.push({
                            filesystem: parts[0],
                            size: parts[1],
                            used: parts[2],
                            avail: parts[3],
                            percent: parts[4],
                            mount: mount
                        });
                    }
                }
            }
            resolve(disks);
        });
    });
};

module.exports = { getStorageInfo };

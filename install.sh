#!/bin/bash

# Warna untuk tampilan keren
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}       INSTALLER HAZIVAULT NAS v3.0      ${NC}"
echo -e "${BLUE}=========================================${NC}"

# 1. Cek Node.js
echo -e "${GREEN}[+] Memeriksa Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "Node.js tidak ditemukan. Menginstall..."
    if [ -x "$(command -v apt)" ]; then
        sudo apt update && sudo apt install -y nodejs npm
    elif [ -x "$(command -v pkg)" ]; then
        pkg install nodejs
    fi
else
    echo "Node.js sudah terinstall."
fi

# 2. Download Source Code
echo -e "${GREEN}[+] Mengunduh HaziVault...${NC}"
TARGET_DIR="/opt/hazivault"

# Jika di Termux, folder beda
if [ -x "$(command -v pkg)" ]; then
    TARGET_DIR="$HOME/hazivault"
fi

if [ -d "$TARGET_DIR" ]; then
    echo "Folder sudah ada, melakukan update..."
    cd $TARGET_DIR
    git pull
else
    git clone https://github.com/z1dan820/hazivault.git $TARGET_DIR
fi

# 3. Install Dependency
echo -e "${GREEN}[+] Menginstall Library (NPM)...${NC}"
cd $TARGET_DIR
npm install --production

# 4. Setup Auto-Start (Systemd untuk Armbian/Linux)
if [ -d "/etc/systemd/system" ]; then
    echo -e "${GREEN}[+] Membuat Service Auto-Start...${NC}"
    cat <<EOT | sudo tee /etc/systemd/system/hazivault.service
[Unit]
Description=HaziVault NAS Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$TARGET_DIR
ExecStart=$(which node) $TARGET_DIR/server/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOT
    sudo systemctl daemon-reload
    sudo systemctl enable hazivault
    sudo systemctl start hazivault
    echo "Service Systemd Berhasil dibuat!"
fi

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}✅ INSTALASI SELESAI!${NC}"
echo -e "Akses HaziVault di: http://$(hostname -I | awk '{print $1}'):3000"
echo -e "${BLUE}=========================================${NC}"

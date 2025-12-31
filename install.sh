#!/bin/bash

# Warna
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}    INSTALLER HAZIVAULT NAS v3.0.4       ${NC}"
echo -e "${BLUE}=========================================${NC}"

# --- LOGIKA PINTAR: CEK SUDO & TERMUX ---
if [ -x "$(command -v pkg)" ]; then
    IS_TERMUX=true
    SUDO="" 
    INSTALL_CMD="pkg install -y"
    TARGET_DIR="$HOME/hazivault"
    echo -e "${YELLOW}[!] Mendeteksi Lingkungan Termux${NC}"
else
    IS_TERMUX=false
    TARGET_DIR="/opt/hazivault"
    INSTALL_CMD="apt install -y"
    if command -v sudo &> /dev/null; then SUDO="sudo"; else SUDO=""; fi
    echo -e "${YELLOW}[!] Mendeteksi Lingkungan Linux/STB${NC}"
fi

# Fungsi Install Paket
install_pkg() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${YELLOW}[+] Menginstall $1...${NC}"
        $SUDO $INSTALL_CMD $1
    else
        echo -e "${GREEN}[OK] $1 sudah terinstall.${NC}"
    fi
}

# 1. Persyaratan Sistem
echo -e "${BLUE}[1/5] Memeriksa Persyaratan...${NC}"
if [ "$IS_TERMUX" = false ]; then $SUDO apt update; fi

install_pkg git
install_pkg nodejs
install_pkg python
install_pkg make
install_pkg binutils # Penting untuk linking kompilasi

# FIX KHUSUS TERMUX (DISTUTILS ERROR)
if [ "$IS_TERMUX" = true ]; then
    echo -e "${YELLOW}[+] Memasang Fix Python Setuptools via PIP...${NC}"
    pip install setuptools
fi

# 2. Download Source Code
echo -e "${BLUE}[2/5] Mengunduh HaziVault...${NC}"
if [ -d "$TARGET_DIR" ]; then
    cd "$TARGET_DIR" && git pull
else
    git clone https://github.com/z1dan820/hazivault.git "$TARGET_DIR"
fi

# 3. Install NPM Modules
echo -e "${BLUE}[3/5] Menginstall Dependency...${NC}"
cd "$TARGET_DIR"

# Step ini untuk memastikan sqlite3 dapet library yang bener di Termux
if [ "$IS_TERMUX" = true ]; then
    export LDFLAGS="-L${PREFIX}/lib"
    export CPPFLAGS="-I${PREFIX}/include"
fi

npm install --production

# 4. PM2 Setup
echo -e "${BLUE}[4/5] Mengatur PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    $SUDO npm install -g pm2
fi

pm2 delete hazivault 2>/dev/null
pm2 start server/index.js --name hazivault
pm2 save

# 5. Auto-Start
echo -e "${BLUE}[5/5] Mengatur Auto-Start...${NC}"
if [ "$IS_TERMUX" = true ]; then
    if ! grep -q "pm2 resurrect" ~/.bashrc; then
        echo "pm2 resurrect >/dev/null 2>&1" >> ~/.bashrc
    fi
else
    $SUDO env PATH=$PATH:$(dirname $(which node)) $(which pm2) startup systemd -u $(whoami) --hp $HOME
    pm2 save
fi

# --- TAMPILAN AKHIR (IP FIX) ---
echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}✅ INSTALASI SELESAI WAK GENG!${NC}"
echo -e "Cek Status: pm2 status"
echo -e ""
echo -e "Buka di Browser:"

MY_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -n 1)
if [ -z "$MY_IP" ]; then
    MY_IP=$(ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | cut -d/ -f1 | head -n 1)
fi
if [ -z "$MY_IP" ]; then MY_IP="localhost"; fi

echo -e "👉 ${BLUE}http://$MY_IP:3000${NC}"
echo -e "${BLUE}=========================================${NC}"

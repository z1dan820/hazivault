#!/bin/bash

# Warna
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}    INSTALLER HAZIVAULT NAS v3.0.2       ${NC}"
echo -e "${BLUE}=========================================${NC}"

# --- LOGIKA PINTAR: CEK SUDO & TERMUX ---
if [ -x "$(command -v pkg)" ]; then
    # Jika di Termux
    IS_TERMUX=true
    SUDO="" 
    INSTALL_CMD="pkg install -y"
    TARGET_DIR="$HOME/hazivault"
    echo -e "${YELLOW}[!] Mendeteksi Lingkungan Termux${NC}"
else
    # Jika di Linux (STB/Server)
    IS_TERMUX=false
    TARGET_DIR="/opt/hazivault"
    INSTALL_CMD="apt install -y"
    # Cek apakah sudo tersedia
    if command -v sudo &> /dev/null; then
        SUDO="sudo"
    else
        SUDO=""
    fi
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
install_pkg python3
install_pkg make

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
npm install --production

# 4. PM2 Setup
echo -e "${BLUE}[4/5] Mengatur PM2 (Background Process)...${NC}"
if ! command -v pm2 &> /dev/null; then
    $SUDO npm install -g pm2
fi

# Reset proses PM2
pm2 delete hazivault 2>/dev/null
pm2 start server/index.js --name hazivault
pm2 save

# 5. Auto-Start
echo -e "${BLUE}[5/5] Mengatur Auto-Start...${NC}"
if [ "$IS_TERMUX" = true ]; then
    if ! grep -q "pm2 resurrect" ~/.bashrc; then
        echo "pm2 resurrect >/dev/null 2>&1" >> ~/.bashrc
    fi
    echo -e "${GREEN}Auto-start Termux aktif via .bashrc${NC}"
else
    # Linux Systemd
    $SUDO env PATH=$PATH:$(dirname $(which node)) $(which pm2) startup systemd -u $(whoami) --hp $HOME
    pm2 save
    echo -e "${GREEN}Auto-start Linux aktif via Systemd${NC}"
fi

# --- TAMPILAN AKHIR (IP FIX) ---
echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}✅ INSTALASI SELESAI WAK GENG!${NC}"
echo -e "Cek Status: pm2 status"
echo -e ""
echo -e "Buka di Browser:"

# Cara dapet IP yang aman buat Termux & Linux
MY_IP=$(ip addr | grep 'state UP' -A2 | tail -n1 | awk '{print $2}' | cut -f1 -d'/')
if [ -z "$MY_IP" ]; then MY_IP="localhost"; fi

echo -e "👉 ${BLUE}http://$MY_IP:3000${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}[1/5] Memeriksa Persyaratan Sistem...${NC}"
install_pkg git
install_pkg nodejs
install_pkg python # Kadang dibutuhkan untuk build
install_pkg make

# 2. Download/Update Source Code
echo -e "${BLUE}[2/5] Mengunduh HaziVault...${NC}"
TARGET_DIR="/opt/hazivault"
IS_TERMUX=false

# Cek jika ini Termux
if [ -d "$HOME/.termux" ] || [ -x "$(command -v termux-setup-storage)" ]; then
    IS_TERMUX=true
    TARGET_DIR="$HOME/hazivault"
fi

if [ -d "$TARGET_DIR" ]; then
    echo "Folder sudah ada, melakukan update..."
    cd $TARGET_DIR
    git pull
else
    git clone https://github.com/z1dan820/hazivault.git $TARGET_DIR
fi

# 3. Install Dependency Project
echo -e "${BLUE}[3/5] Menginstall Library Project...${NC}"
cd $TARGET_DIR
npm install --production

# 4. Install PM2 (Process Manager) Global
echo -e "${BLUE}[4/5] Menginstall & Setting PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Stop proses lama jika ada
pm2 delete hazivault 2>/dev/null

# Jalankan Aplikasi dengan PM2
pm2 start server/index.js --name hazivault

# Save list proses saat ini
pm2 save

# 5. Setup Auto-Start (Reboot)
echo -e "${BLUE}[5/5] Mengatur Auto-Start saat Reboot...${NC}"

if [ "$IS_TERMUX" = true ]; then
    # --- LOGIKA KHUSUS TERMUX ---
    # Di Termux, kita masukkan perintah 'pm2 resurrect' ke .bashrc
    # Jadi saat user buka aplikasi Termux, server otomatis nyala.
    
    if ! grep -q "pm2 resurrect" ~/.bashrc; then
        echo "pm2 resurrect >/dev/null 2>&1" >> ~/.bashrc
    fi
    echo -e "${GREEN}[OK] Auto-start Termux diatur (via .bashrc).${NC}"
    echo -e "${YELLOW}Catatan Termux: Server akan jalan saat Anda membuka aplikasi Termux.${NC}"

else
    # --- LOGIKA LINUX / STB (Systemd) ---
    # PM2 punya fitur startup generator untuk Linux
    
    # Deteksi user saat ini
    CURRENT_USER=$(whoami)
    
    # Generate startup script & Execute
    if [ "$EUID" -ne 0 ]; then
         # Jika bukan root (misal user biasa pakai sudo), perlu trik
         sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $CURRENT_USER --hp $HOME
    else
         pm2 startup systemd
    fi
    
    pm2 save
    echo -e "${GREEN}[OK] Auto-start Systemd berhasil diatur.${NC}"
fi

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}✅ INSTALASI SUKSES WAK GENG! & SUDAH BERJALAN di BACKGROUND!${NC}"
echo -e "Cek status server: pm2 status"
echo -e "Lihat log server : pm2 log hazivault"
echo -e ""
echo -e "Sekarang Buka di Browser:"
if [ -x "$(command -v hostname)" ]; then
    echo -e "👉 http://$(hostname -I | awk '{print $1}'):3000"
else
    echo -e "👉 http://localhost:3000"
fi
echo -e "${BLUE}=========================================${NC}"

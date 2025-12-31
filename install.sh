
#!/bin/bash

# Warna biar keren
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}    INSTALLER HAZIVAULT NAS              ${NC}"
echo -e "${BLUE}=========================================${NC}"

# FUNGSI DETEKSI & INSTALL PAKET
install_pkg() {
    PACKAGE=$1
    if ! command -v $PACKAGE &> /dev/null; then
        echo -e "${YELLOW}[!] $PACKAGE tidak ditemukan. Menginstall...${NC}"
        if [ -x "$(command -v apt)" ]; then
            sudo apt update && sudo apt install -y $PACKAGE
        elif [ -x "$(command -v pkg)" ]; then
            pkg install -y $PACKAGE
        fi
    else
        echo -e "${GREEN}[OK] $PACKAGE sudah ada.${NC}"
    fi
}

# 1. Pastikan Git & Node.js terinstall
echo -e "${BLUE}[1/5] Memeriksa Persyaratan Sistem...${NC}"
install_pkg git
install_pkg nodejs
install_pkg python3 # Kadang dibutuhkan untuk build
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
echo -e "${GREEN}✅ INSTALASI SUKSES & BERJALAN di BACKGROUND!${NC}"
echo -e "Cek status server: pm2 status"
echo -e "Lihat log server : pm2 log hazivault"
echo -e ""
echo -e "Akses di Browser:"
if [ -x "$(command -v hostname)" ]; then
    echo -e "👉 http://$(hostname -I | awk '{print $1}'):3000"
else
    echo -e "👉 http://localhost:3000"
fi
echo -e "${BLUE}=========================================${NC}"

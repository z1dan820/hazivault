#!/bin/bash
set -e

# ================= WARNA =================
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}    INSTALLER HAZIVAULT NAS (FINAL)       ${NC}"
echo -e "${BLUE}=========================================${NC}"

# ================= DETEKSI TERMUX =================
IS_TERMUX=false
if [ -d "$HOME/.termux" ] || command -v termux-setup-storage >/dev/null 2>&1; then
    IS_TERMUX=true
fi

# Pastikan PATH aman (root / user)
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

# ================= FUNGSI INSTALL =================
install_pkg() {
    PKG=$1
    if ! command -v $PKG >/dev/null 2>&1; then
        echo -e "${YELLOW}[!] Menginstall $PKG...${NC}"
        if command -v apt >/dev/null 2>&1; then
            sudo apt update
            sudo apt install -y $PKG
        elif command -v pkg >/dev/null 2>&1; then
            pkg install -y $PKG
        fi
    else
        echo -e "${GREEN}[OK] $PKG tersedia${NC}"
    fi
}

# ================= STEP 1 =================
echo -e "${BLUE}[1/5] Cek kebutuhan sistem...${NC}"
install_pkg git
install_pkg curl
install_pkg make

# ================= NODE.JS =================
if ! command -v node >/dev/null 2>&1; then
    echo -e "${YELLOW}[!] Node.js belum ada, menginstall LTS...${NC}"
    if [ "$IS_TERMUX" = false ]; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt install -y nodejs
    else
        pkg install -y nodejs
    fi
fi

# Pastikan npm ada
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${YELLOW}[!] npm tidak ditemukan, menginstall...${NC}"
    if command -v apt >/dev/null 2>&1; then
        sudo apt install -y npm
    else
        pkg install -y npm
    fi
fi

echo -e "${GREEN}[OK] Node.js $(node -v)${NC}"
echo -e "${GREEN}[OK] npm $(npm -v)${NC}"

# ================= STEP 2 =================
echo -e "${BLUE}[2/5] Clone / Update HaziVault...${NC}"

if [ "$IS_TERMUX" = true ]; then
    TARGET_DIR="$HOME/hazivault"
else
    TARGET_DIR="/opt/hazivault"
fi

if [ -d "$TARGET_DIR/.git" ]; then
    cd "$TARGET_DIR"
    git pull
else
    if [ "$IS_TERMUX" = false ]; then
        sudo mkdir -p "$TARGET_DIR"
        sudo chown $USER:$USER "$TARGET_DIR"
    fi
    git clone https://github.com/z1dan820/hazivault.git "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

# ================= STEP 3 =================
echo -e "${BLUE}[3/5] Install dependency...${NC}"
npm install --omit=dev

# ================= STEP 4 =================
echo -e "${BLUE}[4/5] Install & setup PM2...${NC}"

if ! command -v pm2 >/dev/null 2>&1; then
    if [ "$IS_TERMUX" = false ]; then
        sudo npm install -g pm2
    else
        npm install -g pm2
    fi
fi

pm2 delete hazivault >/dev/null 2>&1 || true
pm2 start server/index.js --name hazivault
pm2 save

# ================= STEP 5 =================
echo -e "${BLUE}[5/5] Setup auto-start...${NC}"

if [ "$IS_TERMUX" = true ]; then
    if ! grep -q "pm2 resurrect" ~/.bashrc; then
        echo "pm2 resurrect >/dev/null 2>&1" >> ~/.bashrc
    fi
    echo -e "${GREEN}[OK] Auto-start Termux aktif (.bashrc)${NC}"
else
    if command -v systemctl >/dev/null 2>&1; then
        pm2 startup systemd -u $USER --hp $HOME
        pm2 save
        echo -e "${GREEN}[OK] Auto-start systemd aktif${NC}"
    else
        echo -e "${YELLOW}[!] systemd tidak tersedia, skip auto-start${NC}"
    fi
fi

# ================= SELESAI =================
echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}✅ HAZIVAULT BERHASIL TERPASANG & BERJALAN${NC}"
echo -e "Status : pm2 status"
echo -e "Log    : pm2 logs hazivault"
echo -e ""

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo -e "Akses  : http://${IP:-localhost}:3000"
echo -e "${BLUE}=========================================${NC}"

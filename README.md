# 🚀 HaziVault NAS System

![HaziVault Logo](images/hazi.png)

**HaziVault** adalah sistem Network Attached Storage (NAS) yang ringan, cepat, dan modern berbasis Node.js. Didesain khusus untuk perangkat berdaya rendah seperti STB Armbian, Termux (Android), dan VPS kecil.

Menampilkan antarmuka pengguna (UI) bertema **Cyber/NASA** yang estetik dan fungsional.

---

## 🔥 Fitur Utama

* **Dashboard Estetik:** Desain Dark Mode Holographic "NASA Style".
* **Storage Detection:** Otomatis mendeteksi penggunaan disk (SD Card, HDD, SSD) via `df -h`.
* **File Manager:**
    * ⚡ Upload File (Drag & Drop support via input).
    * 📥 Download File.
    * 👁️ Preview/Review langsung (Gambar, Video MP4, PDF).
    * 🗑️ Hapus File.
* **Keamanan:** Sistem Login/Auth menggunakan Hash password (bcrypt).
* **Database:** SQLite3 (Otomatis dibuat di folder `data/`).
* **Responsif:** Berjalan lancar di Browser HP maupun Desktop.

---

## 📂 Struktur Proyek

hazivault/
├─ server/             # Logika Backend
│  ├─ index.js         # Server Utama (Express)
│  ├─ db.js            # Koneksi Database SQLite
│  └─ storage.js       # Deteksi Disk/Storage
├─ web/                # Frontend (UI)
│  ├─ assets/          
│  │  ├─ style.css     # NASA Theme CSS
│  │  └─ app.js        # Logic Javascript UI
│  ├─ index.html       # Halaman Login
│  ├─ setup.html       # Halaman Register Awal
│  └─ dashboard.html   # Halaman Utama NAS
├─ data/               # Folder Penyimpanan (Auto Generated)
│  ├─ hazivault.db     # Database User
│  └─ uploads/         # File User tersimpan disini
├─ images/
│  └─ hazi.png         # Logo Project
└─ package.json        # Konfigurasi Node.js


🛠️ Instalasi

Prasyarat

Pastikan Node.js (versi 14+) sudah terinstall.

1. Instalasi di Armbian / Linux VPS / Windows
 
   git clone [https://github.com/z1dan820/hazivault.git](https://github.com/z1dan820/hazivault.git)
   cd hazivault

3. Install Depedensi
   npm install

4. jalankan server
   npm start

5. Akses:
   Buka browser dan akses IP perangkat Anda di port 3000.
   Contoh: http://192.168.1.10:3000

*Instalasi Khusus Termux (Android)*

1. Setup Storage Termux:
Penting agar HaziVault bisa membaca penyimpanan internal.
   termux-setup-storage

3. Install Node & Python (untuk build sqlite3):
   pkg update && pkg upgrade
   pkg install nodejs python make clang
   
   (Catatan: Jika instalasi sqlite3 gagal di Termux, gunakan npm install sqlite3 --build-from-source)
   
5. Jalankan:
   node server/index.js

📖 Cara Penggunaan

  Setup Pertama Kali:
   Buka aplikasi di browser.
   Klik link "Setup Here" di halaman login.
   Buat username dan password admin baru.
  Login:
   Masuk menggunakan akun yang baru dibuat.
  Upload File:
   Di Dashboard, pilih file pada kolom "UPLOAD_PROTOCOL" dan klik tombol Upload.
  Preview File:
   Jika file berupa Gambar, Video, atau PDF, tombol VIEW akan muncul di tabel.
   

⚠️ Catatan Keamanan
Proyek ini masih dalam tahap Development.
File database disimpan di data/hazivault.db.
File upload disimpan di data/uploads/.
Jangan gunakan di production environment level enterprise tanpa menambahkan HTTPS/SSL.
Made with ❤️ by [Fahrul Hamzidan Pulungan]

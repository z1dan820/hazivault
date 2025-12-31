# ![HaziVault Logo](images/hazi.png) 

<p align="center">
  <img src="https://img.shields.io/badge/MADE%20WITH-NODE.JS-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Made with Node.js">
  <img src="https://img.shields.io/badge/JAVASCRIPT-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/DOCKER-READY-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/RELEASE-v3.0.1-orange?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/LICENSE-MIT-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/MAINTAINED-YES-blue?style=for-the-badge" alt="Maintained">
</p>

<a href="https://github.com/z1dan820">
  <img src="https://img.shields.io/badge/GITHUB-z1dan820-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub z1dan820">
</a>


HAZIVAULT NAS v3.0

**HaziVault** adalah sistem Network Attached Storage (NAS) DIY yang ringan, aman, dan modern, dibangun di atas Node.js. Didesain khusus untuk berjalan optimal di perangkat berdaya rendah seperti STB Armbian, Single Board Computer (SBC), atau bahkan Termux di Android.

Versi 3.0 hadir dengan antarmuka pengguna (UI) bertema **Emerald Dark Premium** yang segar, peningkatan keamanan, dan fitur manajemen file tingkat lanjut.

---
# ![Dokumentasi](images/ss1.jpg)
# ![Dokumentasi](images/ss2.jpg)
# ![Dokumentasi](images/ss3.jpg)


## 🔥 Fitur Utama v3.0

### 🎨 Antarmuka & Pengalaman Pengguna
* **Desain Premium:** Tema "Emerald Green" gelap yang modern dengan elemen glassmorphism.
* **Mobile-First:** Tampilan sepenuhnya responsif, dioptimalkan untuk penggunaan di smartphone maupun desktop.
* **Smart Thumbnails:**
    * 🖼️ Preview langsung untuk file Gambar (JPG, PNG, dll).
    * 🎬 Preview frame awal untuk file Video (MP4, MKV).
    * 📄 Ikon spesifik berwarna untuk PDF, Word, Excel, Zip, dan Audio.

### 📂 Manajemen File Canggih
* **Deep Navigation:** Mendukung pembuatan dan navigasi ke dalam sub-folder tanpa batas kedalaman.
* **Multi-Select Mode:**
    * Tekan tahan (HP) atau Klik kanan (PC) untuk masuk mode seleksi.
    * Pilih banyak file sekaligus untuk **Hapus Massal** atau **Download Massal**.
* **Context Menu:** Klik kanan atau tekan tahan pada file individu untuk opsi cepat: *Rename, Delete, Download*.
* **Upload Multiple:** Upload banyak file sekaligus dengan indikator progress bar real-time.

### ⚙️ Sistem & Keamanan
* **Storage Management:** Deteksi otomatis drive yang terpasang (USB/HDD Eksternal) dan kemampuan untuk mengganti lokasi penyimpanan data utama langsung dari Dashboard.
* **Real-time Monitoring:** Pantau penggunaan CPU, RAM, dan kapasitas Disk secara langsung.
* **Keamanan Token:** Sistem login berbasis token untuk melindungi akses ke dashboard dan API.
* **Konfigurasi Persisten:** Pengaturan penyimpanan disimpan secara otomatis dan tetap ada meskipun perangkat direstart.

---

## 🛠️ Prasyarat

* **Node.js** (Versi 14.0.0 ke atas disarankan).
* **NPM** (Node Package Manager).
* Sistem Operasi berbasis Linux (Armbian, Ubuntu, Debian, atau Termux) untuk dukungan penuh perintah sistem (`df -h`).

---

## 🚀 Instalasi & Menjalankan

Ikuti langkah-langkah ini untuk menginstal HaziVault di perangkat Anda:

**1. Clone Repositori**
```bash
git clone https://github.com/z1dan820/hazivault.git
cd hazivault
```
**2. Install Depedensi**
```bash
npm install
```
**3. Jalankan HaziVault**
```bash
npm start
```
## 🐳 Instalasi via Docker (Paling Mudah)

Jika Anda menggunakan Docker, instalasi HaziVault bisa dilakukan dengan satu baris perintah:

```bash
docker run -d \
  --name hazivault \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  ghcr.io/z1dan820/hazivault:latest

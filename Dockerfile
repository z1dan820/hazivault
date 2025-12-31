# Gunakan Node.js versi ringan
FROM node:18-alpine

# Buat folder kerja
WORKDIR /app

# Copy file package.json dulu (biar cache efisien)
COPY package.json ./

# Install dependensi (termasuk sqlite3 dan tools build jika perlu)
RUN apk add --no-cache python3 make g++ && \
    npm install --production && \
    npm rebuild sqlite3

# Copy seluruh source code
COPY . .

# Buat folder data dan images jika belum ada
RUN mkdir -p data/uploads images

# Expose port 3000
EXPOSE 3000

# Perintah menjalankan aplikasi
CMD ["npm", "start"]

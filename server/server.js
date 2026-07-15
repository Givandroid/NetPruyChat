/**
 * server.js
 * Titik masuk (entry point) aplikasi. Menggabungkan:
 *   - Express  : melayani halaman web (HTTP) + endpoint upload + file statis.
 *   - Socket.IO: komunikasi chat real-time dua arah (WebSocket) di atas HTTP.
 *
 * Jalankan dengan: npm start
 */

// Memuat variabel dari file .env (kredensial SMTP, PORT, dll) ke process.env.
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const { PORT, UPLOAD_DIR } = require("./config");
const uploadHandler = require("./uploadHandler");
const authHandler = require("./authHandler");
const { registerSocketHandlers } = require("./socketHandlers");

// Pastikan folder uploads/ ada sebelum server menerima file.
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Rute & middleware HTTP ---

// Mem-parsing body JSON untuk endpoint autentikasi (register/login/logout).
app.use(express.json());

// Menyajikan seluruh file frontend (HTML, CSS, JS) dari folder public/.
app.use(express.static(path.join(__dirname, "..", "public")));

// Menyajikan file hasil upload agar bisa dibuka/diunduh lewat URL /uploads/...
app.use("/uploads", express.static(UPLOAD_DIR));

// Endpoint autentikasi (POST /api/register, /api/login, /api/logout).
app.use("/", authHandler);

// Endpoint upload file (POST /upload).
app.use("/", uploadHandler);

// --- Komunikasi real-time ---

// Setiap ada client baru terhubung, daftarkan seluruh handler event-nya.
io.on("connection", (socket) => {
  console.log(`[connect]    ${socket.id}`);
  registerSocketHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
  });
});

// --- Jalankan server ---
server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

// Menangani error tingkat proses agar server tidak diam-diam mati tanpa jejak.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

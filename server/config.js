/**
 * config.js
 * Konfigurasi terpusat aplikasi. Semua nilai yang mungkin perlu diubah
 * (port, batas ukuran file, tipe file yang diizinkan) dikumpulkan di sini
 * agar mudah diatur tanpa menyentuh logika utama.
 */

const path = require("path");

// Direktori tempat menyimpan file yang diunggah user.
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

module.exports = {
  // Port server. Bisa di-override lewat environment variable saat deploy.
  PORT: process.env.PORT || 3000,

  UPLOAD_DIR,

  // --- Verifikasi email ---
  // Kode verifikasi yang dikirim ke email user saat registrasi.
  VERIFICATION: {
    CODE_LENGTH: 6, // panjang kode (digit)
    TTL_MS: 10 * 60 * 1000, // masa berlaku kode: 10 menit
    MAX_ATTEMPTS: 5, // batas percobaan salah sebelum kode dibatalkan
  },

  // Kredensial SMTP Gmail. Diisi lewat environment variable (.env), TIDAK
  // ditulis di kode agar tidak bocor. Buat "App Password" di akun Google:
  //   Google Account -> Security -> 2-Step Verification -> App passwords.
  // Bila kosong, server tetap jalan tetapi kode verifikasi hanya dicetak ke
  // console (mode pengembangan) — cocok untuk demo tanpa email asli.
  MAIL: {
    USER: process.env.SMTP_USER || "",
    PASS: process.env.SMTP_PASS || "",
    FROM: process.env.SMTP_FROM || "NetPruyChat <no-reply@netPruyChat.local>",
  },

  // Batas ukuran file: 25 MB. Melindungi server dari file berukuran ekstrem.
  MAX_FILE_SIZE: 25 * 1024 * 1024,

  // Jumlah pesan terakhir per room yang disimpan di memori.
  // Dipakai agar user yang baru bergabung tetap melihat sebagian riwayat.
  MAX_HISTORY_PER_ROOM: 100,

  // Tipe file yang diizinkan (berdasarkan MIME type).
  // Mencakup gambar, PDF, dan dokumen umum (Word, Excel, PowerPoint, teks).
  ALLOWED_MIME_TYPES: [
    // Gambar
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // PDF
    "application/pdf",
    // Microsoft Word
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Microsoft Excel
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Microsoft PowerPoint
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // Teks & arsip
    "text/plain",
    "application/zip",
  ],
};

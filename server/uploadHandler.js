/**
 * uploadHandler.js
 * Menangani upload file melalui HTTP (endpoint POST /upload) menggunakan multer.
 *
 * Alur transfer file dipisah dari chat teks:
 *   1. Client meng-upload file via HTTP POST -> file disimpan ke disk.
 *   2. Server membalas dengan metadata file (nama, url, ukuran, tipe).
 *   3. Client lalu mengirim pesan lewat Socket.IO berisi metadata tersebut,
 *      sehingga semua anggota room bisa menampilkan/mengunduh file.
 *
 * Pemisahan ini membuat transfer file besar tidak membebani jalur WebSocket
 * dan sekaligus menunjukkan penggunaan dua protokol: HTTP + WebSocket.
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const { UPLOAD_DIR, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } = require("./config");

// Menentukan lokasi dan penamaan file yang disimpan.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Nama unik: <acak>-<timestamp><ekstensi asli> untuk hindari tabrakan nama.
    const uniqueName =
      crypto.randomBytes(8).toString("hex") +
      "-" +
      Date.now() +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

// Hanya menerima tipe file yang ada di daftar izin (lihat config.js).
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tipe file tidak didukung."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const router = express.Router();

/**
 * POST /upload
 * Menerima satu file dengan field name "file". Mengembalikan metadata file
 * dalam format JSON yang nanti dipakai client untuk mengirim pesan file.
 */
router.post("/upload", (req, res) => {
  // upload.single dibungkus manual agar error (ukuran/tipe) bisa dibalas rapi.
  upload.single("file")(req, res, (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Ukuran file melebihi batas 25 MB."
          : err.message || "Gagal mengunggah file.";
      return res.status(400).json({ success: false, error: message });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "Tidak ada file yang diunggah." });
    }

    // originalname dikirim client sebagai latin1 oleh multer; decode ke UTF-8
    // supaya nama file berbahasa non-ASCII tetap tampil benar.
    const originalName = Buffer.from(req.file.originalname, "latin1").toString(
      "utf8"
    );

    res.json({
      success: true,
      file: {
        originalName,
        url: "/uploads/" + req.file.filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
  });
});

module.exports = router;

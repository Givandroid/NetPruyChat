/**
 * sessions.js
 * Menyimpan token sesi login di memori (RAM): token -> displayName.
 * Saat user login, server membuat token acak. Token ini disimpan client di
 * sessionStorage (per-tab) sehingga refresh halaman tidak membuat user ter-logout.
 *
 * Bersifat sementara: jika server restart, semua token hilang dan user perlu
 * login lagi. Ini cukup dan aman untuk kebutuhan tugas.
 */

const crypto = require("crypto");

const sessions = new Map(); // token -> displayName

module.exports = {
  /** Membuat token baru untuk sebuah user dan mengembalikannya. */
  create(displayName) {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, displayName);
    return token;
  },

  /** Mengembalikan displayName pemilik token, atau undefined bila tidak valid. */
  getUser(token) {
    return sessions.get(token);
  },

  /** Menghapus token (dipakai saat logout). */
  remove(token) {
    sessions.delete(token);
  },
};

/**
 * userStore.js
 * Menyimpan data akun user secara persisten ke file JSON (data/users.json).
 * Password TIDAK disimpan apa adanya, melainkan sebagai hash + salt memakai
 * scrypt (modul crypto bawaan Node) agar aman meski file terbaca orang lain.
 *
 * Struktur file:
 *   { "budi": {
 *       "displayName": "Budi", "email": "budi@gmail.com",
 *       "salt": "...", "hash": "...", "verified": false, "createdAt": 0
 *   } }
 * Kunci objek memakai username huruf kecil supaya unik tanpa peduli kapital.
 *
 * Registrasi TIDAK langsung aktif: akun dibuat dengan verified=false dan baru
 * bisa dipakai login setelah user memverifikasi kode yang dikirim ke email.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Pastikan folder & file penyimpanan ada saat modul pertama kali dimuat.
function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "{}");
}
ensureFile();

function load() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    // Bila file rusak/kosong, mulai dari objek kosong agar server tetap jalan.
    return {};
  }
}

function save(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Membuat hash password dengan salt acak.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

// Membandingkan password yang dimasukkan dengan hash tersimpan (aman timing).
function verifyPassword(password, salt, hash) {
  const attempt = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(attempt), Buffer.from(hash));
}

// Validasi format email sederhana (cukup untuk kebutuhan tugas).
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const keyOf = (username) => (username || "").trim().toLowerCase();

module.exports = {
  keyOf,

  /**
   * Mendaftarkan akun baru (status belum terverifikasi).
   * Bila username sudah ada TAPI belum terverifikasi, data diperbarui agar
   * user bisa mencoba lagi (mis. salah email). Bila sudah terverifikasi,
   * registrasi ditolak.
   * @returns {{ success: boolean, error?: string, key?: string,
   *             displayName?: string, email?: string }}
   */
  register(username, email, password) {
    const name = (username || "").trim();
    const mail = (email || "").trim();

    if (name.length < 3)
      return { success: false, error: "Username minimal 3 karakter." };
    if (!isValidEmail(mail))
      return { success: false, error: "Format email tidak valid." };
    if ((password || "").length < 4)
      return { success: false, error: "Password minimal 4 karakter." };

    const users = load();
    const key = keyOf(name);

    if (users[key] && users[key].verified) {
      return { success: false, error: "Username sudah terdaftar." };
    }

    // Cegah satu email dipakai banyak akun terverifikasi.
    const emailTaken = Object.entries(users).some(
      ([k, u]) => k !== key && u.verified && u.email === mail.toLowerCase()
    );
    if (emailTaken) {
      return { success: false, error: "Email sudah dipakai akun lain." };
    }

    const { salt, hash } = hashPassword(password);
    users[key] = {
      displayName: name,
      email: mail.toLowerCase(),
      salt,
      hash,
      verified: false,
      createdAt: Date.now(),
    };
    save(users);
    return { success: true, key, displayName: name, email: mail.toLowerCase() };
  },

  /** Menandai akun sebagai terverifikasi. */
  markVerified(key) {
    const users = load();
    if (!users[key]) return { success: false, error: "Akun tidak ditemukan." };
    users[key].verified = true;
    save(users);
    return { success: true, displayName: users[key].displayName };
  },

  /** Mengembalikan email & nama akun (untuk keperluan kirim ulang kode). */
  getPending(key) {
    const users = load();
    const u = users[key];
    if (!u || u.verified) return null;
    return { displayName: u.displayName, email: u.email };
  },

  /**
   * Memvalidasi login. Menolak akun yang belum diverifikasi.
   * @returns {{ success: boolean, error?: string, needVerify?: boolean,
   *             displayName?: string }}
   */
  authenticate(username, password) {
    const users = load();
    const record = users[keyOf(username)];
    if (!record || !verifyPassword(password || "", record.salt, record.hash)) {
      return { success: false, error: "Username atau password salah." };
    }
    if (!record.verified) {
      return {
        success: false,
        needVerify: true,
        error: "Email belum diverifikasi. Silakan masukkan kode verifikasi.",
      };
    }
    return { success: true, displayName: record.displayName };
  },
};

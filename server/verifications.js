/**
 * verifications.js
 * Menyimpan kode verifikasi email sementara di memori (RAM):
 *   key(username) -> { code, expiresAt, attempts }
 *
 * Kode bersifat sekali-pakai dan berumur pendek (lihat config VERIFICATION).
 * Disimpan di memori (bukan file) karena hanya relevan sesaat; bila server
 * restart, user cukup minta kirim ulang kode.
 */

const crypto = require("crypto");
const { VERIFICATION } = require("./config");

const codes = new Map(); // usernameKey -> { code, expiresAt, attempts }

/** Membuat kode numerik acak sepanjang CODE_LENGTH digit. */
function generateCode() {
  const max = 10 ** VERIFICATION.CODE_LENGTH;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(VERIFICATION.CODE_LENGTH, "0");
}

module.exports = {
  /** Membuat & menyimpan kode baru untuk sebuah user, lalu mengembalikannya. */
  issue(usernameKey) {
    const code = generateCode();
    codes.set(usernameKey, {
      code,
      expiresAt: Date.now() + VERIFICATION.TTL_MS,
      attempts: 0,
    });
    return code;
  },

  /**
   * Memverifikasi kode yang dimasukkan user.
   * @returns {{ ok: boolean, error?: string }}
   */
  verify(usernameKey, input) {
    const entry = codes.get(usernameKey);
    if (!entry) {
      return { ok: false, error: "Kode tidak ditemukan. Minta kirim ulang." };
    }
    if (Date.now() > entry.expiresAt) {
      codes.delete(usernameKey);
      return { ok: false, error: "Kode kedaluwarsa. Minta kirim ulang." };
    }
    if (entry.attempts >= VERIFICATION.MAX_ATTEMPTS) {
      codes.delete(usernameKey);
      return {
        ok: false,
        error: "Terlalu banyak percobaan. Minta kirim ulang kode.",
      };
    }

    entry.attempts += 1;
    if (String(input || "").trim() !== entry.code) {
      const sisa = VERIFICATION.MAX_ATTEMPTS - entry.attempts;
      return { ok: false, error: `Kode salah. Sisa percobaan: ${sisa}.` };
    }

    // Berhasil: kode dihapus agar tidak bisa dipakai ulang.
    codes.delete(usernameKey);
    return { ok: true };
  },
};

/**
 * authHandler.js
 * Menyediakan endpoint HTTP untuk autentikasi (JSON):
 *   POST /api/register  { username, email, password }  -> daftar (belum aktif)
 *   POST /api/verify    { username, code }              -> aktifkan akun
 *   POST /api/resend    { username }                    -> kirim ulang kode
 *   POST /api/login     { username, password }          -> login, balas token
 *   POST /api/logout    { token }                       -> hapus sesi
 *
 * Alur registrasi memakai verifikasi email:
 *   1. /api/register  -> akun dibuat verified=false, kode dikirim ke email.
 *   2. /api/verify    -> user memasukkan kode; bila cocok, akun aktif.
 *   3. /api/login     -> baru bisa login setelah terverifikasi.
 */

const express = require("express");
const userStore = require("./userStore");
const sessions = require("./sessions");
const verifications = require("./verifications");
const mailer = require("./mailer");

const router = express.Router();

// Membuat & mengirim kode verifikasi ke email pemilik akun.
async function sendCode(key, displayName, email) {
  const code = verifications.issue(key);
  const { delivered } = await mailer.sendVerificationCode(email, displayName, code);
  return delivered;
}

router.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body || {};
  const result = userStore.register(username, email, password);
  if (!result.success) return res.status(400).json(result);

  try {
    const delivered = await sendCode(result.key, result.displayName, result.email);
    res.json({
      success: true,
      needVerify: true,
      username: result.displayName,
      // delivered=false berarti mode dev (kode tampil di console server).
      delivered,
      message: delivered
        ? `Kode verifikasi telah dikirim ke ${result.email}.`
        : "SMTP belum dikonfigurasi — kode dicetak di console server (mode dev).",
    });
  } catch (err) {
    console.error("[register] gagal kirim email:", err.message);
    res.status(502).json({
      success: false,
      error: "Akun dibuat, tetapi gagal mengirim email. Coba 'Kirim ulang kode'.",
    });
  }
});

router.post("/api/verify", (req, res) => {
  const { username, code } = req.body || {};
  const key = userStore.keyOf(username);

  const check = verifications.verify(key, code);
  if (!check.ok) return res.status(400).json({ success: false, error: check.error });

  const marked = userStore.markVerified(key);
  if (!marked.success) return res.status(400).json(marked);

  res.json({ success: true, username: marked.displayName });
});

router.post("/api/resend", async (req, res) => {
  const { username } = req.body || {};
  const key = userStore.keyOf(username);
  const pending = userStore.getPending(key);
  if (!pending) {
    return res
      .status(400)
      .json({ success: false, error: "Akun tidak ditemukan atau sudah aktif." });
  }

  try {
    const delivered = await sendCode(key, pending.displayName, pending.email);
    res.json({ success: true, delivered });
  } catch (err) {
    console.error("[resend] gagal kirim email:", err.message);
    res.status(502).json({ success: false, error: "Gagal mengirim email." });
  }
});

router.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const result = userStore.authenticate(username, password);
  if (!result.success) {
    // needVerify menandai akun ada & password benar tapi belum diverifikasi.
    return res.status(result.needVerify ? 403 : 401).json(result);
  }

  const token = sessions.create(result.displayName);
  res.json({ success: true, token, username: result.displayName });
});

router.post("/api/logout", (req, res) => {
  const { token } = req.body || {};
  if (token) sessions.remove(token);
  res.json({ success: true });
});

module.exports = router;

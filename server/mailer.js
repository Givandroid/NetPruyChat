/**
 * mailer.js
 * Bertanggung jawab mengirim email verifikasi berisi kode 6 digit.
 *
 * Menggunakan nodemailer dengan SMTP Gmail. Kredensial diambil dari
 * environment variable (lihat config.js / file .env), bukan ditulis di kode.
 *
 * Mode pengembangan: bila kredensial SMTP belum diisi, email TIDAK dikirim
 * ke internet, melainkan kodenya dicetak ke console server. Ini membuat
 * aplikasi tetap bisa diuji/demonstrasikan tanpa akun email sungguhan.
 */

const nodemailer = require("nodemailer");
const { MAIL } = require("./config");

// Transport dibuat hanya bila kredensial tersedia.
const isConfigured = Boolean(MAIL.USER && MAIL.PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: MAIL.USER, pass: MAIL.PASS },
    })
  : null;

/**
 * Mengirim kode verifikasi ke sebuah alamat email.
 * @param {string} to    - alamat email tujuan
 * @param {string} name  - nama tampilan penerima (untuk sapaan)
 * @param {string} code  - kode verifikasi yang dikirim
 * @returns {Promise<{ delivered: boolean }>} delivered=false berarti mode dev
 *          (kode hanya dicetak ke console, tidak benar-benar terkirim).
 */
async function sendVerificationCode(to, name, code) {
  // Mode pengembangan: tanpa kredensial, cukup cetak ke console.
  if (!transporter) {
    console.log(
      `[mailer] (mode dev — SMTP belum dikonfigurasi)\n` +
        `         Kode verifikasi untuk ${to}: ${code}`
    );
    return { delivered: false };
  }

  // Kode dipecah agar ada spasi antar digit (mudah dibaca).
  const spacedCode = code.split("").join("  ");
  const year = new Date().getFullYear();

  // Template email tema gelap (shadcn "zinc dark") — disamakan dengan tampilan
  // website. Memakai layout tabel + CSS inline agar konsisten di klien email
  // (Gmail, Outlook, dll). Palet: latar #09090b, kartu #111113, border #27272a,
  // teks utama #fafafa, teks redup #a1a1aa, aksen putih (tanpa warna mencolok).
  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#09090b;padding:40px 16px;font-family:'Segoe UI',Arial,Helvetica,sans-serif">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0"
             style="max-width:480px;width:100%;background:#111113;border:1px solid #27272a;border-radius:16px">

        <!-- Header: monogram N + wordmark, seperti brand-mark aplikasi -->
        <tr><td style="padding:26px 30px 6px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:40px;height:40px;background:#fafafa;border-radius:10px;
                       text-align:center;vertical-align:middle;color:#18181b;
                       font-size:20px;font-weight:700;font-family:Arial,sans-serif">N</td>
            <td style="padding-left:12px;color:#fafafa;font-size:18px;font-weight:700;
                       letter-spacing:-0.3px">NetPruyChat</td>
          </tr></table>
        </td></tr>

        <!-- Judul + salam -->
        <tr><td style="padding:14px 30px 0">
          <div style="color:#fafafa;font-size:19px;font-weight:600;margin-bottom:6px">
            Kode verifikasi
          </div>
          <div style="color:#a1a1aa;font-size:14px;line-height:1.65">
            Halo <span style="color:#e4e4e7;font-weight:600">${name}</span>, gunakan
            kode di bawah untuk mengaktifkan akun kamu. Jangan bagikan kode ini
            kepada siapa pun.
          </div>
        </td></tr>

        <!-- Kotak OTP -->
        <tr><td style="padding:22px 30px 6px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;
                           padding:20px;text-align:center;color:#fafafa;font-size:30px;
                           font-weight:700;letter-spacing:2px;
                           font-family:'Consolas','Courier New',monospace">${spacedCode}</td></tr>
          </table>
          <div style="color:#71717a;font-size:12.5px;margin-top:12px">
            Kode berlaku selama 10 menit.
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 30px 24px">
          <div style="border-top:1px solid #1f1f23;padding-top:16px">
            <div style="color:#52525b;font-size:12px;line-height:1.6">
              Abaikan email ini bila kamu tidak merasa mendaftar di NetPruyChat.
            </div>
            <div style="color:#3f3f46;font-size:11px;margin-top:8px">
              &copy; ${year} NetPruyChat &middot; PJAR Tugas Akhir
            </div>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>`;

  await transporter.sendMail({
    from: MAIL.FROM,
    to,
    subject: `Kode Verifikasi (OTP) Anda: ${code}`,
    text: `Kode verifikasi NetPruyChat Anda: ${code} (berlaku 10 menit). Jangan berikan kepada siapa pun.`,
    html,
  });

  return { delivered: true };
}

module.exports = { sendVerificationCode };

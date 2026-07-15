/**
 * socketHandlers.js
 * Mendefinisikan semua event komunikasi real-time via Socket.IO (WebSocket).
 *
 * Ringkasan event:
 *   Client -> Server : join, chatMessage, fileMessage, typing, stopTyping
 *   Server -> Client : history, message, notice, roomUsers, typing, stopTyping
 */

const crypto = require("crypto");
const chatManager = require("./chatManager");
const sessions = require("./sessions");

/** Membuat objek pesan standar yang dipakai untuk semua jenis pesan. */
function buildMessage({ username, room, type, text = "", file = null }) {
  return {
    id: crypto.randomUUID(),
    username,
    room,
    type, // "text" | "file"
    text,
    file, // metadata file bila type === "file"
    timestamp: Date.now(),
  };
}

/** Mengirim daftar user online sebuah room ke seluruh anggotanya. */
function broadcastRoomUsers(io, room) {
  io.to(room).emit("roomUsers", {
    room,
    users: chatManager.getUsersInRoom(room),
  });
}

/**
 * Mendaftarkan seluruh handler event untuk satu koneksi socket.
 * Dipanggil sekali setiap ada client yang terhubung.
 */
function registerSocketHandlers(io, socket) {
  // --- User bergabung ke sebuah room ---
  socket.on("join", ({ token, room }, callback) => {
    // Identitas diambil dari token sesi, bukan dari input mentah client,
    // sehingga hanya user yang sudah login yang bisa masuk room.
    const username = sessions.getUser(token);
    if (!username) {
      return callback?.({
        success: false,
        authError: true, // sinyal ke client agar meminta login ulang
        error: "Sesi tidak valid. Silakan login ulang.",
      });
    }

    if (!room || !room.trim()) {
      return callback?.({ success: false, error: "Nama room wajib diisi." });
    }

    const roomName = room.trim();

    // Bila user yang sama sudah punya koneksi di room ini (mis. karena refresh
    // atau login di tab lain), putuskan koneksi lamanya. Ini dianggap
    // "reconnect", bukan anggota baru, jadi notifikasi masuk tidak dikirim.
    const oldSockets = chatManager.removeByUsername(roomName, username);
    oldSockets.forEach((id) => io.sockets.sockets.get(id)?.disconnect());
    const isReconnect = oldSockets.length > 0;

    const user = chatManager.addUser(socket.id, username, roomName);
    socket.join(user.room);

    // Kirim riwayat pesan room ke user yang baru bergabung saja.
    callback?.({ success: true, username: user.username, room: user.room });
    socket.emit("history", chatManager.getHistory(user.room));

    // Beri tahu anggota lain hanya bila ini benar-benar user baru.
    if (!isReconnect) {
      socket.to(user.room).emit("notice", {
        text: `${user.username} bergabung ke room.`,
        timestamp: Date.now(),
      });
    }

    broadcastRoomUsers(io, user.room);
  });

  // --- Pesan teks biasa ---
  socket.on("chatMessage", (text) => {
    const user = chatManager.getUser(socket.id);
    if (!user || typeof text !== "string" || !text.trim()) return;

    const message = buildMessage({
      username: user.username,
      room: user.room,
      type: "text",
      text: text.trim(),
    });

    chatManager.saveMessage(user.room, message);
    io.to(user.room).emit("message", message);
  });

  // --- Pesan berisi file (metadata dari hasil upload HTTP) ---
  socket.on("fileMessage", (file) => {
    const user = chatManager.getUser(socket.id);
    // Validasi minimal metadata file agar tidak ada data cacat yang tersebar.
    if (!user || !file || !file.url || !file.originalName) return;

    const message = buildMessage({
      username: user.username,
      room: user.room,
      type: "file",
      file: {
        originalName: file.originalName,
        url: file.url,
        size: file.size,
        mimeType: file.mimeType,
      },
    });

    chatManager.saveMessage(user.room, message);
    io.to(user.room).emit("message", message);
  });

  // --- Indikator sedang mengetik (dikirim ke anggota lain, bukan pengirim) ---
  socket.on("typing", () => {
    const user = chatManager.getUser(socket.id);
    if (!user) return;
    socket.to(user.room).emit("typing", { username: user.username });
  });

  socket.on("stopTyping", () => {
    const user = chatManager.getUser(socket.id);
    if (!user) return;
    socket.to(user.room).emit("stopTyping", { username: user.username });
  });

  // --- Koneksi terputus (tab ditutup / jaringan hilang) ---
  socket.on("disconnect", () => {
    const user = chatManager.removeUser(socket.id);
    if (!user) return;

    socket.to(user.room).emit("notice", {
      text: `${user.username} keluar dari room.`,
      timestamp: Date.now(),
    });
    broadcastRoomUsers(io, user.room);
  });
}

module.exports = { registerSocketHandlers };

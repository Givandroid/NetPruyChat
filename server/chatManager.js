/**
 * chatManager.js
 * Menyimpan seluruh state chat di memori (RAM): daftar user per koneksi,
 * anggota tiap room, dan riwayat pesan terakhir per room.
 *
 * Catatan: karena in-memory, semua data hilang saat server dimatikan.
 * Ini sesuai kebutuhan tugas (ringan, tanpa database). File fisik hasil
 * upload tetap tersimpan di disk, hanya metadata pesannya yang di memori.
 */

const { MAX_HISTORY_PER_ROOM } = require("./config");

class ChatManager {
  constructor() {
    // socketId -> { username, room }
    this.users = new Map();

    // namaRoom -> array pesan terakhir (dibatasi MAX_HISTORY_PER_ROOM)
    this.history = new Map();
  }

  /**
   * Mendaftarkan user baru ke sebuah room.
   * @returns {{ username: string, room: string }} data user yang tersimpan
   */
  addUser(socketId, username, room) {
    const user = { username: username.trim(), room: room.trim() };
    this.users.set(socketId, user);
    return user;
  }

  /** Mengambil data user berdasarkan id koneksi socket. */
  getUser(socketId) {
    return this.users.get(socketId);
  }

  /**
   * Menghapus user (misalnya saat disconnect) dan mengembalikan datanya
   * agar pemanggil bisa memberi tahu anggota room lain.
   */
  removeUser(socketId) {
    const user = this.users.get(socketId);
    this.users.delete(socketId);
    return user;
  }

  /** Mengembalikan daftar username yang sedang berada di sebuah room. */
  getUsersInRoom(room) {
    const members = [];
    for (const user of this.users.values()) {
      if (user.room === room) members.push(user.username);
    }
    return members;
  }

  /**
   * Menghapus koneksi lama milik username yang sama di sebuah room, lalu
   * mengembalikan daftar socketId-nya. Dipakai saat user refresh / login ulang
   * agar koneksi lamanya digantikan (satu akun = satu koneksi aktif per room).
   */
  removeByUsername(room, username) {
    const target = username.trim().toLowerCase();
    const socketIds = [];
    for (const [socketId, user] of this.users) {
      if (user.room === room && user.username.toLowerCase() === target) {
        socketIds.push(socketId);
      }
    }
    socketIds.forEach((id) => this.users.delete(id));
    return socketIds;
  }

  /**
   * Menyimpan sebuah pesan ke riwayat room. Riwayat dipangkas agar tidak
   * tumbuh tanpa batas (hanya menyimpan N pesan terakhir).
   */
  saveMessage(room, message) {
    if (!this.history.has(room)) this.history.set(room, []);
    const messages = this.history.get(room);
    messages.push(message);
    if (messages.length > MAX_HISTORY_PER_ROOM) messages.shift();
  }

  /** Mengambil riwayat pesan sebuah room (kosong jika belum ada). */
  getHistory(room) {
    return this.history.get(room) || [];
  }
}

// Diekspor sebagai satu instance (singleton) agar state dibagi seluruh server.
module.exports = new ChatManager();

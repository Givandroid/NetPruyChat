/**
 * socket.js
 * Membungkus seluruh komunikasi Socket.IO di sisi client. Menyediakan objek
 * global `ChatSocket` dengan fungsi ringkas (join, kirim pesan, kirim file,
 * typing) dan menyalurkan event dari server ke callback yang diberikan app.js.
 */

const ChatSocket = (() => {
  // io() otomatis terhubung ke server yang menyajikan halaman ini.
  const socket = io();

  return {
    /**
     * Mendaftarkan handler untuk event yang datang dari server.
     * @param {object} handlers - kumpulan callback (onMessage, onNotice, dst).
     */
    init(handlers) {
      socket.on("connect", () => handlers.onConnect?.());
      socket.on("disconnect", () => handlers.onDisconnect?.());

      socket.on("history", (messages) => handlers.onHistory?.(messages));
      socket.on("message", (message) => handlers.onMessage?.(message));
      socket.on("notice", (notice) => handlers.onNotice?.(notice));
      socket.on("roomUsers", (data) => handlers.onRoomUsers?.(data));

      socket.on("typing", (data) => handlers.onTyping?.(data));
      socket.on("stopTyping", (data) => handlers.onStopTyping?.(data));
    },

    /**
     * Meminta bergabung ke room memakai token sesi hasil login.
     * callback menerima {success, error, authError, username, room}.
     */
    join(token, room, callback) {
      socket.emit("join", { token, room }, callback);
    },

    sendMessage(text) {
      socket.emit("chatMessage", text);
    },

    sendFile(fileMeta) {
      socket.emit("fileMessage", fileMeta);
    },

    emitTyping() {
      socket.emit("typing");
    },

    emitStopTyping() {
      socket.emit("stopTyping");
    },
  };
})();

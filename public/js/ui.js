/**
 * ui.js
 * Semua urusan tampilan (DOM): merender pesan, notifikasi, daftar user,
 * avatar, dan status koneksi. Dikumpulkan di objek global `UI` agar file lain
 * (socket.js, app.js) tinggal memanggil tanpa menyentuh DOM langsung.
 */

const UI = (() => {
  // Cache elemen-elemen yang sering dipakai.
  const el = {
    loginScreen: document.getElementById("login-screen"),
    loginError: document.getElementById("login-error"),
    chatScreen: document.getElementById("chat-screen"),
    roomName: document.getElementById("room-name"),
    userList: document.getElementById("user-list"),
    userCount: document.getElementById("user-count"),
    messages: document.getElementById("messages"),
    typing: document.getElementById("typing-indicator"),
    status: document.getElementById("connection-status"),
    statusText: document.querySelector("#connection-status .status-text"),
    meAvatar: document.getElementById("me-avatar"),
    meName: document.getElementById("me-name"),
  };

  // Nama user saat ini; disimpan agar render bisa menandai "pesan saya".
  let currentUsername = "";

  // Palet warna avatar. Warna dipilih deterministik dari nama user.
  const AVATAR_COLORS = [
    "#4f46e5", "#7c3aed", "#db2777", "#e11d48", "#ea580c",
    "#059669", "#0891b2", "#2563eb", "#0d9488", "#d97706",
  ];

  function avatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  function initial(name) {
    return name.trim().charAt(0).toUpperCase() || "?";
  }

  // Membuat elemen avatar bulat dengan inisial & warna khas user.
  function makeAvatar(name, small = false) {
    const span = document.createElement("span");
    span.className = "avatar" + (small ? " sm" : "");
    span.style.background = avatarColor(name);
    span.textContent = initial(name);
    return span;
  }

  // Mencegah XSS: teks dari user selalu di-escape sebelum masuk ke innerHTML.
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatBytes(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function isImage(mimeType) {
    return typeof mimeType === "string" && mimeType.startsWith("image/");
  }

  // Label singkat berdasarkan ekstensi nama file (mis. "PDF", "DOCX").
  // Mengganti ikon emoji dengan penanda teks yang bersih.
  function fileLabel(file) {
    const name = file.originalName || "";
    const ext = name.includes(".") ? name.split(".").pop().toUpperCase() : "";
    if (ext) return ext.slice(0, 4);
    if (file.mimeType && file.mimeType.includes("pdf")) return "PDF";
    if (file.mimeType && file.mimeType.includes("word")) return "DOC";
    if (file.mimeType && file.mimeType.includes("sheet")) return "XLS";
    return "FILE";
  }

  function scrollToBottom() {
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  // Membuat isi HTML untuk pesan berjenis file (gambar atau dokumen).
  function renderFileContent(file) {
    if (isImage(file.mimeType)) {
      return `
        <div class="file-image">
          <a href="${escapeHtml(file.url)}" target="_blank" rel="noopener">
            <img src="${escapeHtml(file.url)}" alt="${escapeHtml(
        file.originalName
      )}" />
          </a>
        </div>`;
    }
    return `
      <a class="file-card" href="${escapeHtml(
        file.url
      )}" target="_blank" rel="noopener" download>
        <span class="file-icon">${escapeHtml(fileLabel(file))}</span>
        <span>
          <div class="file-name">${escapeHtml(file.originalName)}</div>
          <div class="file-size">${formatBytes(file.size)}</div>
        </span>
      </a>`;
  }

  return {
    /** Menyimpan nama user aktif & menampilkannya di profil sidebar. */
    setCurrentUser(name) {
      currentUsername = name;
      el.meName.textContent = name;
      el.meAvatar.style.background = avatarColor(name);
      el.meAvatar.textContent = initial(name);
    },

    /** Pindah dari layar login ke layar chat. */
    showChat(room) {
      el.loginScreen.classList.add("hidden");
      el.chatScreen.classList.remove("hidden");
      el.roomName.textContent = room;
    },

    showLoginError(message) {
      el.loginError.textContent = message || "";
    },

    clearMessages() {
      el.messages.innerHTML = "";
    },

    /** Merender satu pesan (teks atau file). */
    addMessage(message) {
      const mine = message.username === currentUsername;

      const row = document.createElement("div");
      row.className = "msg-row" + (mine ? " me" : "");

      // Avatar hanya ditampilkan untuk pesan orang lain.
      if (!mine) row.appendChild(makeAvatar(message.username));

      const bubble = document.createElement("div");
      bubble.className = "bubble";

      const body =
        message.type === "file"
          ? renderFileContent(message.file)
          : `<div class="bubble-text">${escapeHtml(message.text)}</div>`;

      // Nama pengirim hanya perlu ditampilkan untuk pesan orang lain.
      const author = mine
        ? ""
        : `<div class="bubble-author" style="color:${avatarColor(
            message.username
          )}">${escapeHtml(message.username)}</div>`;

      bubble.innerHTML = `
        ${author}
        ${body}
        <div class="bubble-time">${formatTime(message.timestamp)}</div>`;

      row.appendChild(bubble);
      el.messages.appendChild(row);
      scrollToBottom();
    },

    /** Merender pesan sistem (mis. user bergabung/keluar). */
    addNotice(text) {
      const div = document.createElement("div");
      div.className = "notice";
      div.textContent = text;
      el.messages.appendChild(div);
      scrollToBottom();
    },

    /** Memperbarui daftar user online di sidebar. */
    setUsers(users) {
      el.userCount.textContent = users.length;
      el.userList.innerHTML = "";
      users.forEach((name) => {
        const li = document.createElement("li");
        li.className = "user-item";

        li.appendChild(makeAvatar(name, true));

        const nameSpan = document.createElement("span");
        nameSpan.className = "u-name";
        nameSpan.textContent = name;
        li.appendChild(nameSpan);

        if (name === currentUsername) {
          const tag = document.createElement("span");
          tag.className = "you-tag";
          tag.textContent = "Kamu";
          li.appendChild(tag);
        }

        el.userList.appendChild(li);
      });
    },

    /** Menampilkan indikator "sedang mengetik". */
    setTyping(usernames) {
      if (!usernames.length) {
        el.typing.textContent = "";
      } else if (usernames.length === 1) {
        el.typing.textContent = `${usernames[0]} sedang mengetik…`;
      } else {
        el.typing.textContent = `${usernames.length} orang sedang mengetik…`;
      }
    },

    /** Mengubah indikator status koneksi (connected/disconnected). */
    setConnectionStatus(state) {
      el.status.className = "status " + state;
      el.statusText.textContent =
        state === "connected"
          ? "Terhubung"
          : state === "disconnected"
          ? "Terputus — menyambung…"
          : "Menghubungkan…";
    },
  };
})();

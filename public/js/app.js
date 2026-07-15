/**
 * app.js
 * Orkestrator sisi client: autentikasi (login, daftar, verifikasi kode email),
 * persistensi sesi lewat sessionStorage, pengiriman pesan, dan upload file.
 */

(() => {
  const SESSION_KEY = "netPruychat_session"; // { token, username, room }

  // File yang dipilih user sebelum dikirim.
  let selectedFile = null;

  // Melacak siapa saja yang sedang mengetik (untuk indikator).
  const typingUsers = new Map(); // username -> timeout id

  // --- Ambil elemen yang dibutuhkan ---
  const loginForm = document.getElementById("login-form");
  const usernameInput = document.getElementById("username-input");
  const emailInput = document.getElementById("email-input");
  const emailField = document.getElementById("email-field");
  const passwordInput = document.getElementById("password-input");
  const roomInput = document.getElementById("room-input");
  const loginBtn = document.getElementById("login-btn");
  const registerBtn = document.getElementById("register-btn");
  // Kartu verifikasi email.
  const verifyForm = document.getElementById("verify-form");
  const codeInput = document.getElementById("code-input");
  const resendBtn = document.getElementById("resend-btn");
  const verifyBackBtn = document.getElementById("verify-back-btn");
  const verifyInfo = document.getElementById("verify-info");
  const verifyError = document.getElementById("verify-error");

  // Mode form login: "login" (default) atau "register".
  let authMode = "login";
  // Menyimpan data pendaftaran sementara sampai verifikasi selesai.
  let pendingRegister = null; // { username, password, room }
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");
  const fileInput = document.getElementById("file-input");
  const filePreview = document.getElementById("file-preview");
  const filePreviewName = document.getElementById("file-preview-name");
  const fileCancel = document.getElementById("file-cancel");
  const leaveBtn = document.getElementById("leave-btn");

  // =============== SESSION HELPER (sessionStorage, per-tab) ===============
  function saveSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // Pembungkus fetch JSON agar ringkas & menangani error jaringan.
  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // =============== EVENT DARI SERVER ===============
  ChatSocket.init({
    onConnect: () => UI.setConnectionStatus("connected"),
    onDisconnect: () => UI.setConnectionStatus("disconnected"),

    onHistory: (messages) => {
      UI.clearMessages();
      messages.forEach((msg) => UI.addMessage(msg));
    },

    onMessage: (message) => UI.addMessage(message),
    onNotice: (notice) => UI.addNotice(notice.text),
    onRoomUsers: (data) => UI.setUsers(data.users),

    onTyping: ({ username }) => showTyping(username),
    onStopTyping: ({ username }) => removeTyping(username),
  });

  // =============== ALUR MASUK ROOM ===============
  /**
   * Bergabung ke room memakai token sesi. Bila berhasil, simpan sesi dan
   * tampilkan layar chat. Dipakai baik saat login manual maupun auto-login.
   */
  function joinRoom(token, room, { onFail } = {}) {
    ChatSocket.join(token, room, (res) => {
      if (!res || !res.success) {
        // Token kedaluwarsa / server restart -> minta login ulang.
        if (res?.authError) clearSession();
        onFail?.(res?.error || "Gagal bergabung ke room.");
        return;
      }
      saveSession({ token, username: res.username, room: res.room });
      UI.setCurrentUser(res.username);
      UI.showChat(res.room);
      messageInput.focus();
    });
  }

  // Setelah verifikasi berhasil / login manual: login -> join room.
  async function loginAndJoin(username, password, room) {
    const login = await postJSON("/api/login", { username, password });
    if (!login.success) {
      // Akun ada tapi belum diverifikasi -> arahkan ke layar verifikasi.
      if (login.needVerify) {
        pendingRegister = { username, password, room };
        showVerifyScreen(username, "");
        return;
      }
      return UI.showLoginError(login.error);
    }
    joinRoom(login.token, room, { onFail: UI.showLoginError });
  }

  // --- Beralih antara mode LOGIN dan DAFTAR ---
  function setAuthMode(mode) {
    authMode = mode;
    UI.showLoginError("");
    if (mode === "register") {
      emailField.classList.remove("hidden");
      emailInput.required = true;
      loginBtn.textContent = "Daftar Akun";
      registerBtn.textContent = "Sudah punya akun? Masuk";
    } else {
      emailField.classList.add("hidden");
      emailInput.required = false;
      loginBtn.textContent = "Masuk ke Room";
      registerBtn.textContent = "Belum punya akun? Daftar";
    }
  }

  registerBtn.addEventListener("click", () => {
    setAuthMode(authMode === "login" ? "register" : "login");
  });

  // Submit form: perilaku tergantung mode aktif.
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    UI.showLoginError("");

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const room = roomInput.value.trim();

    if (!username || !password || !room) {
      return UI.showLoginError("Isi username, password, dan room dulu.");
    }

    try {
      if (authMode === "register") {
        if (!email) return UI.showLoginError("Email wajib diisi untuk mendaftar.");

        const reg = await postJSON("/api/register", { username, email, password });
        if (!reg.success) return UI.showLoginError(reg.error);

        // Simpan data untuk dipakai setelah verifikasi, lalu tampilkan layar kode.
        pendingRegister = { username, password, room };
        showVerifyScreen(username, reg.message);
      } else {
        await loginAndJoin(username, password, room);
      }
    } catch {
      UI.showLoginError("Tidak dapat terhubung ke server.");
    }
  });

  // =============== ALUR VERIFIKASI EMAIL ===============
  function showVerifyScreen(username, infoMessage) {
    loginForm.classList.add("hidden");
    verifyForm.classList.remove("hidden");
    verifyError.textContent = "";
    codeInput.value = "";
    verifyInfo.textContent =
      infoMessage || `Masukkan kode 6 digit yang dikirim ke email untuk "${username}".`;
    codeInput.focus();
  }

  function showLoginScreen() {
    verifyForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  }

  verifyBackBtn.addEventListener("click", () => {
    pendingRegister = null;
    showLoginScreen();
  });

  // Verifikasi kode -> bila cocok, langsung login & masuk room.
  verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    verifyError.textContent = "";
    if (!pendingRegister) return showLoginScreen();

    const code = codeInput.value.trim();
    if (!code) return (verifyError.textContent = "Masukkan kode verifikasi.");

    try {
      const res = await postJSON("/api/verify", {
        username: pendingRegister.username,
        code,
      });
      if (!res.success) return (verifyError.textContent = res.error);

      const { username, password, room } = pendingRegister;
      pendingRegister = null;
      showLoginScreen();
      setAuthMode("login");
      await loginAndJoin(username, password, room);
    } catch {
      verifyError.textContent = "Tidak dapat terhubung ke server.";
    }
  });

  // Kirim ulang kode verifikasi.
  resendBtn.addEventListener("click", async () => {
    verifyError.textContent = "";
    if (!pendingRegister) return;
    try {
      const res = await postJSON("/api/resend", {
        username: pendingRegister.username,
      });
      verifyError.textContent = res.success
        ? "Kode baru telah dikirim. Periksa email Anda."
        : res.error || "Gagal mengirim ulang kode.";
    } catch {
      verifyError.textContent = "Tidak dapat terhubung ke server.";
    }
  });

  // =============== AUTO-LOGIN SAAT HALAMAN DIMUAT ===============
  (function autoLogin() {
    const session = loadSession();
    if (!session?.token || !session?.room) return;

    // Prefill agar bila auto-login gagal, user tinggal isi password.
    usernameInput.value = session.username || "";
    roomInput.value = session.room || "";

    joinRoom(session.token, session.room, {
      onFail: () => UI.showLoginError("Sesi berakhir, silakan login kembali."),
    });
  })();

  // =============== KIRIM PESAN / FILE ===============
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (selectedFile) {
      await uploadAndSendFile(selectedFile);
      clearFileSelection();
    }

    const text = messageInput.value.trim();
    if (text) {
      ChatSocket.sendMessage(text);
      messageInput.value = "";
    }

    ChatSocket.emitStopTyping();
  });

  // =============== INDIKATOR MENGETIK ===============
  let typingTimeout = null;
  messageInput.addEventListener("input", () => {
    ChatSocket.emitTyping();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => ChatSocket.emitStopTyping(), 1500);
  });

  // =============== PILIH & BATAL FILE ===============
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    selectedFile = file;
    filePreviewName.textContent = file.name;
    filePreview.classList.remove("hidden");
  });

  fileCancel.addEventListener("click", clearFileSelection);

  function clearFileSelection() {
    selectedFile = null;
    fileInput.value = "";
    filePreview.classList.add("hidden");
  }

  // =============== LOGOUT / KELUAR ===============
  leaveBtn.addEventListener("click", async () => {
    const session = loadSession();
    try {
      if (session?.token) await postJSON("/api/logout", { token: session.token });
    } catch {
      /* diabaikan: tetap logout di sisi client meski request gagal */
    }
    clearSession();
    window.location.reload();
  });

  // =============== FUNGSI PENDUKUNG ===============

  /** Upload file via HTTP POST /upload, lalu kirim metadata via Socket.IO. */
  async function uploadAndSendFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) return alert("Gagal mengirim file: " + data.error);
      ChatSocket.sendFile(data.file);
    } catch (err) {
      alert("Terjadi kesalahan saat mengunggah file. Periksa koneksi.");
      console.error(err);
    }
  }

  function showTyping(username) {
    if (typingUsers.has(username)) clearTimeout(typingUsers.get(username));
    // Auto-hilang setelah 3 detik sebagai pengaman bila sinyal stop hilang.
    const timeout = setTimeout(() => removeTyping(username), 3000);
    typingUsers.set(username, timeout);
    UI.setTyping([...typingUsers.keys()]);
  }

  function removeTyping(username) {
    if (typingUsers.has(username)) {
      clearTimeout(typingUsers.get(username));
      typingUsers.delete(username);
    }
    UI.setTyping([...typingUsers.keys()]);
  }
})();

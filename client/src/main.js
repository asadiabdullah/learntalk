// ==========================================
// KONFIGURASI SUPABASE
// ==========================================
// Ganti dengan URL dan Anon Key dari Project Supabase Anda
const SUPABASE_URL = "https://zdaylammqonjurfqalbt.supabase.co"; // Diambil dari ID di database_url ROM
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkYXlsYW1tcW9uanVyZnFhbGJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDgxOTAsImV4cCI6MjEwMjI4NDE5MH0.JKAmovKoo_j8OCDczYn1MULDBfMo87sdqU4N61Gmz9Y"; // TODO: Masukkan Anon Key dari Dashboard Supabase -> API

let supabase;
if (SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 50) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ==========================================
// ELEMEN DOM
// ==========================================
const authView = document.getElementById("auth-view");
const dashboardView = document.getElementById("dashboard-view");
const authError = document.getElementById("auth-error");

const emailInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btn-login");
const btnRegister = document.getElementById("btn-register");
const btnLogout = document.getElementById("btn-logout");

// DOM Element untuk Mobile Responsiveness
const chatArea = document.getElementById("chat-area");

// ==========================================
// FUNGSI UI SEDERHANA
// ==========================================
function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove("hidden");
}

function hideAuthError() {
  authError.classList.add("hidden");
}

function showDashboard() {
  authView.classList.remove("active");
  dashboardView.classList.remove("hidden");
  dashboardView.classList.add("active");
  if (typeof loadPersonas === 'function') loadPersonas();
}

function showAuth() {
  dashboardView.classList.remove("active");
  dashboardView.classList.add("hidden");
  authView.classList.add("active");
}

// ==========================================
// TOAST & MODAL CONFIRM (CUSTOM UI)
// ==========================================
window.showToast = function(message, type = 'info') {
  const container = document.getElementById("toast-container");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  else if (type === "error") icon = "fa-triangle-exclamation";
  
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("hiding");
    toast.addEventListener("animationend", () => toast.remove());
  }, 3000);
};

window.showConfirm = function(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-confirm");
    const msgEl = document.getElementById("confirm-message");
    const btnOk = document.getElementById("btn-confirm-ok");
    const btnCancel = document.getElementById("btn-confirm-cancel");
    
    if (!modal) { resolve(confirm(message)); return; }
    
    msgEl.textContent = message;
    modal.classList.remove("hidden");
    
    const cleanup = () => {
      modal.classList.add("hidden");
      btnOk.replaceWith(btnOk.cloneNode(true));
      btnCancel.replaceWith(btnCancel.cloneNode(true));
    };
    
    btnOk.addEventListener("click", () => { cleanup(); resolve(true); }, { once: true });
    btnCancel.addEventListener("click", () => { cleanup(); resolve(false); }, { once: true });
  });
};

// Override window.alert
window.alert = function(msg) {
  if (msg.toLowerCase().includes("gagal") || msg.toLowerCase().includes("kesalahan") || msg.toLowerCase().includes("maksimal") || msg.toLowerCase().includes("mohon")) {
    showToast(msg, "error");
  } else {
    showToast(msg, "success");
  }
};

// ==========================================
// FUNGSI RESPONSIVE & MENU
// ==========================================
// Dipanggil oleh onclick di HTML
window.openChatMobile = function () {
  if (window.innerWidth <= 768) {
    chatArea.classList.add("active");
  }
};

window.closeChatMobile = function () {
  chatArea.classList.remove("active");
};

// Modal Logic
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
};

window.toggleMenu = function(menuId) {
  // Close all other menus first
  document.querySelectorAll('.dropdown-menu.show').forEach(m => {
    if (m.id !== menuId) m.classList.remove('show');
  });
  
  const menu = document.getElementById(menuId);
  if (menu) {
    menu.classList.toggle('show');
  }
};

// Tutup menu jika klik di luar
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu.show').forEach(m => {
    m.classList.remove('show');
  });
});

// ==========================================
// LOGIKA AUTENTIKASI SUPABASE
// ==========================================

// Load / Create User Profile
async function loadUserProfile(userId, email = "") {
  if (!supabase) return;
  try {
    let { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      // Profile not found, create default one
      const defaultName = email ? email.split("@")[0] : "Pengguna";
      const { data: newProfile, error: createError } = await supabase
        .from("user_profiles")
        .insert([
          {
            id: userId,
            name: defaultName,
            gender: "",
            age: null,
            native_language: "Indonesia",
            language_weakness: "Belum terdeteksi kelemahan spesifik."
          }
        ])
        .select()
        .single();

      if (createError) throw createError;
      profile = newProfile;
    }

    // Save profile details to window/state
    window.userProfile = profile;
    console.log("User profile loaded:", profile);
  } catch (err) {
    console.error("Error loading user profile:", err);
  }
}

// Cek Sesi (Remember Me)
async function checkSession() {
  if (!supabase) {
    console.warn(
      "Supabase belum dikonfigurasi. Menampilkan halaman login secara default.",
    );
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    console.log("Sesi ditemukan. Masuk ke dashboard.");
    await loadUserProfile(session.user.id, session.user.email);
    showDashboard();
  }
}

// Dengarkan perubahan status login
if (supabase) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN") {
      await loadUserProfile(session.user.id, session.user.email);
      showDashboard();
    } else if (event === "SIGNED_OUT") {
      window.userProfile = null;
      showAuth();
    }
  });
}

// Handler Tombol Login
if (btnLogin) {
  btnLogin.addEventListener("click", async () => {
    hideAuthError();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAuthError("Email dan password wajib diisi.");
      return;
    }

    if (!supabase) {
      showAuthError(
        "Sistem Auth belum disetel (Supabase Anon Key kosong). Menggunakan mode bypass untuk UI test.",
      );
      setTimeout(showDashboard, 1000);
      return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = "Memuat...";

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    btnLogin.disabled = false;
    btnLogin.textContent = "Masuk";

    if (error) {
      showAuthError(`Gagal masuk: ${error.message}`);
    }
  });
}

// Handler Tombol Daftar
if (btnRegister) {
  btnRegister.addEventListener("click", async () => {
    hideAuthError();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAuthError("Email dan password wajib diisi untuk mendaftar.");
      return;
    }

    if (!supabase) {
      showAuthError("Sistem Auth belum disetel (Supabase Anon Key kosong).");
      return;
    }

    btnRegister.disabled = true;
    btnRegister.textContent = "Mendaftar...";

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    btnRegister.disabled = false;
    btnRegister.textContent = "Daftar Akun Baru";

    if (error) {
      showAuthError(`Gagal daftar: ${error.message}`);
    } else {
      alert(
        "Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi, atau langsung login jika tidak diperlukan.",
      );
    }
  });
}

// Handler Tombol Logout
btnLogout.addEventListener("click", async () => {
  if (!supabase) {
    showAuth();
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    alert(`Gagal keluar: ${error.message}`);
  }
});

// Inisialisasi awal
checkSession();

// ==========================================
// CUSTOM FLAG SELECT LOGIC
// ==========================================
const langSelected = document.getElementById("lang-selected");
const langOptions = document.getElementById("lang-options");
if (langSelected && langOptions) {
  langSelected.addEventListener("click", function(e) {
    e.stopPropagation();
    langOptions.classList.toggle("select-hide");
  });

  langOptions.querySelectorAll("div").forEach(option => {
    option.addEventListener("click", function(e) {
      const val = this.getAttribute("data-value");
      const imgSrc = this.querySelector("img").src;
      const altText = this.querySelector("img").alt;
      
      langSelected.innerHTML = `<img src="${imgSrc}" alt="${altText}"> <i class="fa-solid fa-chevron-down"></i>`;
      langSelected.setAttribute("data-value", val);
      langOptions.classList.add("select-hide");
    });
  });

  document.addEventListener("click", function() {
    langOptions.classList.add("select-hide");
  });
}

// ==========================================
// MAPPING DICTIONARIES (UI Label <-> DB Scope Text)
// ==========================================
const MAPPING_LANG_LEVEL = {
  jp: {
    "1 — Pemula": "Use short, simple sentences with highly common patterns. Basic vocabulary. Strictly consistent polite form (desu/masu). Use only basic/familiar Kanji; hiragana/katakana must dominate. Avoid keigo, idioms, slang, ellipses, or context-dependent phrasing. Keep meanings fully explicit. (≈ JLPT N5 / CEFR A1)",
    "2 — Dasar": "Vary and combine sentences. Use common grammar patterns and familiar vocabulary. Polite form (desu/masu) remains dominant, but introduce expressive variations. Use common Kanji normally. Allow basic casual form if context fits. (≈ JLPT N4 / CEFR A2)",
    "3 — Menengah": "Use natural conversational Japanese. Allow complex sentences, conjunctions, subordination, aspect/modality nuances, and shifting between polite (desu/masu) and casual forms. Use standard Kanji without simplification. Use common idioms and occasionally implicit meanings. (≈ JLPT N3 / CEFR B1)",
    "4 — Mahir": "Use rich, flexible structures and vocabulary. Adapt registers, politeness levels, social distance, and context. Correctly apply complex Kanji, compound words, keigo, idioms, implicit expressions, ellipses, and expressive variations. (≈ JLPT N2 / CEFR B2–C1)",
    "5 — Natural": "Ensure speech is fully natural for highly proficient native Japanese speakers. No simplified Kanji or vocabulary. Smoothly manage subtle registers, including keigo, casual, formal, slang, idioms, humor, implicatures, emotional nuances, and speech style shifts. Explicit explanations are optional if context is clear. (≈ JLPT N1 / CEFR C1–C2)"
  },
  en: {
    "1 — Pemula": "Use short sentences with basic structures. Use common, concrete vocabulary. Prioritize familiar spelling and word forms. Avoid idioms, slang, uncommon phrasal verbs, metaphors, and complex structures. Convey meaning directly. (≈ CEFR A1)",
    "2 — Dasar": "Use simple sentences with wider structural variations. Common vocabulary remains dominant. Begin using conjunctions, modal verbs, common phrasal verbs, and simple conversational expressions. (≈ CEFR A2)",
    "3 — Menengah": "Use natural conversational English. Allow complex sentences, multiple tenses/aspects, conditionals, relative clauses, modalities, and common idioms. Convey meanings directly or slightly implicitly. (≈ CEFR B1)",
    "4 — Mahir": "Use rich and flexible language. Adapt and switch between casual, neutral, formal, professional, and academic registers. Correctly apply idioms, phrasal verbs, metaphors, nuances, and complex structures. (≈ CEFR B2–C1)",
    "5 — Natural": "Use highly natural and contextual language. Master control over register, tone, idioms, slang, humor, sarcasm, metaphors, implications, word choice, and conversational rhythm. Convey meaning explicitly or implicitly as a highly fluent speaker. (≈ CEFR C1–C2)"
  }
};

const MAPPING_INDO_LEVEL = {
  "1 — Sama sekali tidak tahu": "Do NOT reply in Indonesian. You do not comprehend Indonesian and must not use it to interpret user messages. Treat any Indonesian inputs as an unknown language. Avoid guessing meanings based on word similarities or aggressive context.",
  "2 — Bisa sedikit": "Do NOT reply in Indonesian. You understand basic Indonesian, mainly common words, phrases, and simple sentences. You can grasp the user's basic intent when simple, but struggle with slang, abbreviations, idioms, long sentences, typos, or context-dependent meanings. Never pretend to understand if unsure.",
  "3 — Pandai Indonesia": "Do NOT reply in Indonesian. You understand Indonesian deeply and grasp user intents naturally (formal, informal, slang, abbreviations, idioms, typos, code-switching, and implicit meanings). Use this understanding to maintain flow and respond accurately, but always reply strictly in the target persona language, never in Indonesian."
};

const MAPPING_SPEECH_STYLE = {
  "Netral": "Speak calmly, objectively, and unemotionally. Use clear, direct language. Avoid emojis unless context-critical. Maintain style consistently, but apply minor adjustments to formality and response length to prevent sounding stiff.",
  "Ramah": "Speak warmly, politely, and approachably. Show natural interest in the conversation. Use social responses (acknowledgements, enthusiasm, or appreciation) appropriately. Emojis can be used naturally and occasionally. Match warmth, length, and expressiveness with the conversational mood.",
  "Santai": "Speak like in a natural, light, and everyday conversation. Use target-language informal expressions. Avoid heavy slang unless context-appropriate. Emojis can be used naturally to reinforce mood. Adaptively mirror user's pacing and casualness while preserving persona.",
  "Hangat": "Speak with genuine care, empathy, and emotional closeness. Focus not only on info but also user's feelings. Use emojis gently and selectively. Adapt concern and emotional expressions to context without exaggeration.",
  "Ceria": "Speak with positive energy, enthusiasm, and expressiveness. Use lively reactions and light humor where suitable. Emojis can be used more frequently to support enthusiasm, but keep them relevant. Lower expressiveness for serious topics.",
  "Playful": "Speak with a light, spontaneous, and playful character. Use humor, light teasing, wordplay, and spontaneous reactions where appropriate. Use emojis expressively. Adapt playfulness to user responses; do not force jokes when seriousness is required.",
  "Formal": "Speak politely, structurally, and professionally. Avoid slang, unnecessary jokes, and excessive emotional expression. Avoid emojis unless professional context makes them natural. Adapt length and structure to user needs while maintaining persona's formality.",
  "Akademis": "Speak objectively, precisely, systematically, and argumentatively. Prioritize conceptual clarity, cause-effect relations, and accurate terminology. Avoid emojis, slang, and emotional expressions unless highly relevant. Adapt depth based on user needs.",
  "Profesional": "Speak efficiently, clearly, politely, and goal-oriented. Avoid excessive small talk; focus directly on user needs. Avoid emojis generally, but allow limited use in relaxed professional contexts. Adjust detail, formality, and structure to fit the situation.",
  "Conversational / Natural": "Speak like a natural human conversation: not always perfect or highly structured, but clear and relevant. Adjust length as needed, including spontaneous reactions, light humor, social pauses, and emotional expressions. Use emojis situationally. Highly adaptive to context while preserving persona's identity."
};

function getDbScopeValue(type, uiLabel, language = 'jp') {
  if (type === 'lang_level') {
    return MAPPING_LANG_LEVEL[language][uiLabel] || uiLabel;
  }
  if (type === 'indo_level') {
    return MAPPING_INDO_LEVEL[uiLabel] || uiLabel;
  }
  if (type === 'speech_style') {
    return MAPPING_SPEECH_STYLE[uiLabel] || uiLabel;
  }
  return uiLabel;
}

function getUiLabelValue(type, dbScopeValue, language = 'jp') {
  if (type === 'lang_level') {
    const map = MAPPING_LANG_LEVEL[language];
    for (const key in map) {
      if (map[key] === dbScopeValue) return key;
    }
    return "1 — Pemula";
  }
  if (type === 'indo_level') {
    for (const key in MAPPING_INDO_LEVEL) {
      if (MAPPING_INDO_LEVEL[key] === dbScopeValue) return key;
    }
    return "1 — Sama sekali tidak tahu";
  }
  if (type === 'speech_style') {
    for (const key in MAPPING_SPEECH_STYLE) {
      if (MAPPING_SPEECH_STYLE[key] === dbScopeValue) return key;
    }
    return "Netral";
  }
  return dbScopeValue;
}

// ==========================================
// TAMBAH PERSONA LOGIC
// ==========================================
const btnPilihFoto = document.querySelector(".avatar-upload .btn-text");
const fileInput = document.getElementById("persona-photo");
const avatarPreview = document.querySelector(".avatar-preview");
let selectedPhotoFile = null;

if (btnPilihFoto && fileInput) {
  btnPilihFoto.addEventListener("click", () => fileInput.click());
  avatarPreview.addEventListener("click", () => fileInput.click());
  
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      alert("Ukuran foto maksimal 10MB!");
      fileInput.value = "";
      return;
    }
    
    selectedPhotoFile = file;
    const objectUrl = URL.createObjectURL(file);
    avatarPreview.innerHTML = `<img src="${objectUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    btnPilihFoto.textContent = "Ganti Foto";
  });
}

const formAddPersona = document.getElementById("form-add-persona");
if (formAddPersona) {
  const btnSubmitPersona = formAddPersona.closest(".modal-container").querySelector(".modal-footer .btn-primary");
  
  btnSubmitPersona.addEventListener("click", async () => {
    if (!supabase) {
      alert("Supabase belum terhubung!");
      return;
    }
    
    // Ambil data dari form menggunakan ID agar lebih robust
    const name = document.getElementById("input-name").value.trim();
    const langLevel = document.getElementById("input-lang-level").value;
    const indoLevel = document.getElementById("input-indo-level").value;
    const goal = document.getElementById("input-goal").value.trim();
    const gender = document.getElementById("input-gender").value;
    const age = parseInt(document.getElementById("input-age").value);
    const job = document.getElementById("input-job").value.trim();
    const desc = document.getElementById("input-desc").value.trim();
    const personality = document.getElementById("input-personality").value.trim();
    const speech = document.getElementById("input-speech").value;
    const langValue = langSelected ? langSelected.getAttribute("data-value") : "jp";

    // Validasi Wajib
    if (!name || !gender || isNaN(age)) {
      alert("Mohon lengkapi Nama, Jenis Kelamin, dan Usia.");
      return;
    }

    const sessionData = await supabase.auth.getSession();
    const user = sessionData.data.session?.user;
    if (!user) {
      alert("Anda harus login untuk membuat kontak.");
      return;
    }

    btnSubmitPersona.disabled = true;
    btnSubmitPersona.textContent = "Mengunggah...";

    try {
      let avatarUrl = null;
      
      // Upload Foto jika ada
      if (selectedPhotoFile) {
        const fileExt = selectedPhotoFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, selectedPhotoFile, { upsert: true });
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
          
        avatarUrl = publicUrlData.publicUrl;
      }

      btnSubmitPersona.textContent = "Menyimpan...";

      // Cek apakah mode Edit (punya data-id)
      const personaId = formAddPersona.getAttribute("data-id");
      
      const payload = {
        user_id: user.id,
        name,
        language: langValue,
        lang_level: getDbScopeValue('lang_level', langLevel, langValue),
        indo_level: getDbScopeValue('indo_level', indoLevel),
        goal,
        gender,
        age,
        job,
        description: desc,
        personality,
        speech_style: getDbScopeValue('speech_style', speech, langValue)
      };
      if (avatarUrl) payload.avatar_url = avatarUrl; // update avatar only if new image selected

      if (personaId) {
        // Mode Update
        const { error } = await supabase.from('personas').update(payload).eq('id', personaId);
        if (error) throw error;
        alert("Kontak Persona berhasil diperbarui!");
      } else {
        // Mode Insert
        const { error } = await supabase.from('personas').insert([payload]);
        if (error) throw error;
        alert("Kontak Persona berhasil ditambahkan!");
      }

      closeModal('modal-add-persona');
      formAddPersona.reset();
      formAddPersona.setAttribute("data-id", ""); // clear ID
      document.querySelector('.modal-header h2').textContent = "Tambah Kontak";
      avatarPreview.innerHTML = '<i class="fa-solid fa-camera"></i>';
      btnPilihFoto.textContent = "Pilih Foto";
      selectedPhotoFile = null;
      
      // Refresh daftar kontak di Kiri (Home)
      if (typeof loadPersonas === 'function') loadPersonas();
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      btnSubmitPersona.disabled = false;
      btnSubmitPersona.textContent = "Simpan Kontak";
    }
  });
}

// ==========================================
// RENDER DAFTAR CHAT & MENU TITIK TIGA
// ==========================================
window.loadPersonas = async function() {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  
  const { data: personas, error } = await supabase
    .from('personas')
    .select('*')
    .eq('user_id', session.user.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Gagal memuat persona:", error);
    return;
  }
  
  window.personasData = personas; // Simpan di cache lokal
  const chatListEl = document.querySelector('.chat-list');
  chatListEl.innerHTML = '';
  
  if (personas.length === 0) {
    chatListEl.innerHTML = '<p style="text-align:center; color:var(--text-soft); padding: 20px;">Belum ada kontak. Silakan tambah persona baru.</p>';
    return;
  }
  
  personas.forEach(p => {
    // Generate warna avatar atau gunakan gambar
    let avatarHtml = `<div class="avatar avatar--user">${p.name.charAt(0).toUpperCase()}</div>`;
    if (p.avatar_url) {
      avatarHtml = `<img src="${p.avatar_url}" alt="${p.name}" class="avatar" style="object-fit:cover;">`;
    }
    
    const isPinnedStr = p.is_pinned ? `<i class="fa-solid fa-thumbtack" style="font-size:0.7rem; color:var(--text-soft); margin-right:4px;"></i>` : "";
    const pinText = p.is_pinned ? "Lepas sematan" : "Sematkan";
    
    const html = `
      <article class="chat-item" onclick="openChat('${p.id}')">
          ${avatarHtml}
          <div class="chat-info">
              <div class="chat-meta">
                  <h3>${isPinnedStr}${p.name}</h3>
                  <time>${new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
              </div>
              <div class="chat-preview">
                  <p>Ketuk untuk mulai mengobrol...</p>
              </div>
          </div>
          <button class="menu-btn" onclick="toggleMenu('menu-${p.id}'); event.stopPropagation();">
              <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
          
          <div id="menu-${p.id}" class="dropdown-menu">
              <a href="#" onclick="deletePersona('${p.id}'); event.stopPropagation(); return false;">Hapus chat</a>
              <a href="#" onclick="editPersona('${p.id}'); event.stopPropagation(); return false;">Edit kontak</a>
              <a href="#" onclick="togglePinPersona('${p.id}', ${p.is_pinned}); event.stopPropagation(); return false;">${pinText}</a>
              <a href="#" onclick="event.stopPropagation(); return false;">Tanya leta</a>
          </div>
      </article>
    `;
    chatListEl.insertAdjacentHTML('beforeend', html);
  });
};

window.deletePersona = async function(id) {
  const confirmDelete = await showConfirm("Yakin ingin menghapus kontak ini?");
  if (!confirmDelete) return;
  
  const { error } = await supabase.from('personas').delete().eq('id', id);
  if (error) {
    alert("Gagal menghapus: " + error.message);
  } else {
    loadPersonas();
  }
};

window.togglePinPersona = async function(id, currentStatus) {
  const { error } = await supabase.from('personas').update({ is_pinned: !currentStatus }).eq('id', id);
  if (error) {
    alert("Gagal memperbarui sematan: " + error.message);
  } else {
    loadPersonas();
  }
};

window.editPersona = function(id) {
  const p = window.personasData.find(x => x.id === id);
  if (!p) return;
  
  document.querySelector('.modal-header h2').textContent = "Edit Kontak";
  const formAddPersona = document.getElementById("form-add-persona");
  formAddPersona.setAttribute("data-id", p.id);
  
  // Set nilai
  document.getElementById("input-name").value = p.name || "";
  document.getElementById("input-lang-level").value = getUiLabelValue('lang_level', p.lang_level, p.language);
  document.getElementById("input-indo-level").value = getUiLabelValue('indo_level', p.indo_level);
  document.getElementById("input-goal").value = p.goal || "";
  document.getElementById("input-gender").value = p.gender || "";
  document.getElementById("input-age").value = p.age || "";
  document.getElementById("input-job").value = p.job || "";
  document.getElementById("input-desc").value = p.description || "";
  document.getElementById("input-personality").value = p.personality || "";
  document.getElementById("input-speech").value = getUiLabelValue('speech_style', p.speech_style, p.language);
  
  // Update flag selection visual (assuming flagcdn formats)
  const langSelected = document.getElementById("lang-selected");
  if (langSelected && p.language) {
    langSelected.setAttribute("data-value", p.language);
    const flagCode = p.language === 'en' ? 'gb' : p.language;
    langSelected.innerHTML = `<img src="https://flagcdn.com/w40/${flagCode}.png" alt="${p.language}"> <i class="fa-solid fa-chevron-down"></i>`;
  }
  
  // Update avatar preview
  const avatarPreview = document.querySelector(".avatar-preview");
  const btnPilihFoto = document.querySelector(".avatar-upload .btn-text");
  if (p.avatar_url) {
    avatarPreview.innerHTML = `<img src="${p.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    btnPilihFoto.textContent = "Ganti Foto";
  } else {
    avatarPreview.innerHTML = '<i class="fa-solid fa-camera"></i>';
    btnPilihFoto.textContent = "Pilih Foto";
  }
  
  openModal('modal-add-persona');
};

// ==========================================
// CHATBOT ACTIVE CHAT LOGIC (DUMMY SYSTEM)
// ==========================================
let activePersonaId = null;
let messagesData = {}; // Cache obrolan: { personaId: [ { sender, text, translation, tokens } ] }
let isCorrectionActive = false;
let activeWordCardTokens = [];
let activeWordCardIndex = 0;

// Data Dummy Percakapan untuk JP & EN
const DUMMY_RESPONSES = {
  jp: [
    {
      text: "こんにちは！調子はどうですか？",
      translation: "Halo! Bagaimana kabarmu?",
      tokens: [
        { word: "こんにちは", reading: "Konnichiwa", meaning: "Halo / Selamat siang" },
        { word: "調子", reading: "Choushi", meaning: "Kondisi / Keadaan" },
        { word: "は", reading: "wa", meaning: "Partikel penunjuk subjek" },
        { word: "どうですか", reading: "dou desu ka", meaning: "Bagaimana?" }
      ]
    },
    {
      text: "日本語の勉強は楽しいですか？",
      translation: "Apakah belajar bahasa Jepang itu menyenangkan?",
      tokens: [
        { word: "日本語", reading: "Nihongo", meaning: "Bahasa Jepang" },
        { word: "の", reading: "no", meaning: "Partikel kepemilikan (dari/punya)" },
        { word: "勉強", reading: "Benkyou", meaning: "Belajar" },
        { word: "は", reading: "wa", meaning: "Partikel penunjuk subjek" },
        { word: "楽しい", reading: "Tanoshii", meaning: "Menyenangkan" },
        { word: "ですか", reading: "desu ka", meaning: "Apakah?" }
      ]
    },
    {
      text: "また明日お会いしましょう！",
      translation: "Sampai jumpa besok!",
      tokens: [
        { word: "また", reading: "Mata", meaning: "Lagi / Sampai" },
        { word: "明日", reading: "Ashita", meaning: "Besok" },
        { word: "お会いしましょう", reading: "Oai shimashou", meaning: "Mari bertemu" }
      ]
    }
  ],
  en: [
    {
      text: "Hello! How is your day going so far?",
      translation: "Halo! Bagaimana harimu berjalan sejauh ini?",
      tokens: [
        { word: "Hello", reading: "həˈloʊ", meaning: "Halo" },
        { word: "How", reading: "haʊ", meaning: "Bagaimana" },
        { word: "is", reading: "ɪz", meaning: "Adalah / Tobe" },
        { word: "your", reading: "jɔːr", meaning: "Milikmu" },
        { word: "day", reading: "deɪ", meaning: "Hari" },
        { word: "going", reading: "ˈɡoʊ.ɪŋ", meaning: "Berjalan" },
        { word: "so far", reading: "soʊ fɑːr", meaning: "Sejauh ini" }
      ]
    },
    {
      text: "I am ready to help you practice English anytime.",
      translation: "Saya siap membantu Anda berlatih bahasa Inggris kapan saja.",
      tokens: [
        { word: "I", reading: "aɪ", meaning: "Saya" },
        { word: "am ready", reading: "æm ˈrɛdi", meaning: "Siap" },
        { word: "to help", reading: "tu hɛlp", meaning: "Membantu" },
        { word: "you", reading: "juː", meaning: "Anda / Kamu" },
        { word: "practice", reading: "ˈpræk.tɪs", meaning: "Berlatih" },
        { word: "English", reading: "ˈɪŋ.ɡlɪʃ", meaning: "Bahasa Inggris" },
        { word: "anytime", reading: "ˈɛn.i.taɪm", meaning: "Kapan saja" }
      ]
    },
    {
      text: "Learning English is fun and easy with practice!",
      translation: "Belajar bahasa Inggris menyenangkan dan mudah dengan latihan!",
      tokens: [
        { word: "Learning", reading: "ˈlɜː.nɪŋ", meaning: "Belajar / Pembelajaran" },
        { word: "English", reading: "ˈɪŋ.ɡlɪʃ", meaning: "Bahasa Inggris" },
        { word: "is", reading: "ɪz", meaning: "Adalah" },
        { word: "fun", reading: "fʌn", meaning: "Menyenangkan" },
        { word: "and", reading: "ænd", meaning: "Dan" },
        { word: "easy", reading: "ˈiː.zi", meaning: "Mudah" },
        { word: "with practice", reading: "wɪð ˈpræk.tɪs", meaning: "Dengan latihan" }
      ]
    }
  ]
};

// Event Listener Mode Koreksi
const btnCorrection = document.getElementById("btn-toggle-correction");
if (btnCorrection) {
  btnCorrection.addEventListener("click", () => {
    isCorrectionActive = !isCorrectionActive;
    if (isCorrectionActive) {
      btnCorrection.classList.add("active");
      showToast("Mode Koreksi Aktif: Pesan Anda akan dikoreksi sebelum dikirim.", "info");
    } else {
      btnCorrection.classList.remove("active");
      showToast("Mode Koreksi Dinonaktifkan.", "info");
    }
  });
}

// Event Listener Tanya Leta
const btnAskLeta = document.getElementById("btn-ask-leta");
if (btnAskLeta) {
  btnAskLeta.addEventListener("click", () => {
    const qText = document.getElementById("leta-question").value.trim();
    if (!qText) {
      showToast("Harap ketik pertanyaan Anda.", "error");
      return;
    }
    
    // Tampilkan jawaban dummy
    const answerBox = document.getElementById("leta-answer-box");
    const answerText = document.getElementById("leta-answer-text");
    
    answerBox.classList.remove("hidden");
    answerText.textContent = `Ini adalah penjelasan Leta untuk pertanyaan "${qText}": Menurut tatabahasa, penggunaan kata tersebut harus disesuaikan dengan konteks formal/informal. Anda bisa menggunakannya di kehidupan sehari-hari secara aman.`;
  });
}

// Handler pengiriman pesan
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");

if (btnSend && chatInput) {
  btnSend.addEventListener("click", handleSendMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
}

function handleSendMessage() {
  if (!activePersonaId) {
    showToast("Silakan pilih kontak obrolan terlebih dahulu.", "error");
    return;
  }
  
  const text = chatInput.value.trim();
  if (!text) return;
  
  // Kosongkan input
  chatInput.value = "";
  
  // Masukkan pesan user ke memory cache
  if (!messagesData[activePersonaId]) messagesData[activePersonaId] = [];
  
  // Jika Mode Koreksi Aktif, kirim dengan notifikasi koreksi dummy
  const finalMessage = isCorrectionActive 
    ? `${text} (Telah dikoreksi otomatis)` 
    : text;
    
  messagesData[activePersonaId].push({
    sender: "user",
    text: finalMessage
  });
  
  renderActiveMessages();
  
  // Pemicu Balasan Dummy AI setelah jeda pendek
  setTimeout(() => {
    triggerAiResponse();
  }, 1000);
}

// Membuka Obrolan Kontak
window.openChat = function(id) {
  activePersonaId = id;
  const p = window.personasData.find(x => x.id === id);
  if (!p) return;
  
  console.log("Membuka chat dengan ID:", id);
  
  // Update UI Header
  const activeChatName = document.querySelector(".chat-header-info h2");
  const activeChatStatus = document.querySelector(".chat-header-info p");
  const activeChatAvatarContainer = document.querySelector(".chat-header-profile");
  
  activeChatName.textContent = p.name;
  activeChatStatus.textContent = `Online (${p.language === 'en' ? 'Inggris' : 'Jepang'})`;
  
  // Bersihkan avatar header lama
  const existingAvatar = activeChatAvatarContainer.querySelector(".avatar");
  if (existingAvatar) existingAvatar.remove();
  
  // Buat avatar header baru
  let avatarHtml = "";
  if (p.avatar_url) {
    avatarHtml = `<img src="${p.avatar_url}" alt="${p.name}" class="avatar" style="object-fit:cover; margin-right:12px;">`;
  } else {
    avatarHtml = `<div class="avatar avatar--user" style="margin-right:12px;">${p.name.charAt(0).toUpperCase()}</div>`;
  }
  activeChatAvatarContainer.insertAdjacentHTML("afterbegin", avatarHtml);
  
  // Muat riwayat pesan dari cache, atau isi dengan pesan sambutan dummy jika kosong
  if (!messagesData[activePersonaId]) {
    const lang = p.language || "jp";
    const initialText = lang === 'en' ? "Hello! Let's practice speaking today." : "こんにちは！一緒に日本語を練習しましょう。";
    const initialTranslation = lang === 'en' ? "Halo! Mari kita latihan berbicara hari ini." : "Halo! Mari kita bersama-sama melatih bahasa Jepang.";
    const initialTokens = lang === 'en' 
      ? [
          { word: "Hello", reading: "həˈloʊ", meaning: "Halo" },
          { word: "Let's", reading: "lɛts", meaning: "Mari" },
          { word: "practice", reading: "ˈpræk.tɪs", meaning: "Berlatih" },
          { word: "speaking", reading: "ˈspiː.kɪŋ", meaning: "Berbicara" },
          { word: "today", reading: "təˈdeɪ", meaning: "Hari ini" }
        ]
      : [
          { word: "こんにちは", reading: "Konnichiwa", meaning: "Halo / Selamat siang" },
          { word: "一緒に", reading: "Isshoni", meaning: "Bersama-sama" },
          { word: "日本語", reading: "Nihongo", meaning: "Bahasa Jepang" },
          { word: "を", reading: "o", meaning: "Partikel objek" },
          { word: "練習しましょう", reading: "Renshuu shimashou", meaning: "Mari kita latihan" }
        ];
        
    messagesData[activePersonaId] = [
      {
        sender: "ai",
        text: initialText,
        translation: initialTranslation,
        tokens: initialTokens,
        isPecah: false
      }
    ];
  }
  
  renderActiveMessages();
  openChatMobile();
};

// Render daftar pesan
function renderActiveMessages() {
  const container = document.getElementById("chat-messages");
  if (!container || !activePersonaId) return;
  
  container.innerHTML = "";
  const list = messagesData[activePersonaId] || [];
  
  list.forEach((m, idx) => {
    if (m.sender === "user") {
      // Render balon chat User
      const userHtml = `
        <div class="message-group me">
            <div class="avatar avatar--user">U</div>
            <div class="message-bubble">
                <p>${m.text}</p>
                <span class="time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", userHtml);
    } else {
      // Render balon chat Persona AI
      const p = window.personasData.find(x => x.id === activePersonaId);
      let avatarHtml = `<div class="avatar avatar--user">${p ? p.name.charAt(0).toUpperCase() : "A"}</div>`;
      if (p && p.avatar_url) {
        avatarHtml = `<img src="${p.avatar_url}" alt="${p.name}" class="avatar" style="object-fit:cover;">`;
      }
      
      // Cek apakah mode pecah kata aktif
      let textContent = `<p>${m.text}</p>`;
      if (m.isPecah && m.tokens) {
        let tokensHtml = m.tokens.map((tok, tIdx) => {
          return `<span class="word-token" onclick="openWordCard(${idx}, ${tIdx})">${tok.word}</span>`;
        }).join(" ");
        textContent = `<div class="word-tokens-container">${tokensHtml}</div>`;
      }
      
      const aiHtml = `
        <div class="message-group">
            ${avatarHtml}
            <div class="message-bubble">
                ${textContent}
                
                <div class="translation-text ${m.isTranslate ? 'visible' : ''}">
                  ${m.translation}
                </div>
                
                <div class="message-actions">
                  <button onclick="toggleTranslate(${idx})" class="${m.isTranslate ? 'active' : ''}" title="Terjemah"><i class="fa-solid fa-language"></i></button>
                  <button onclick="togglePecahKata(${idx})" class="${m.isPecah ? 'active' : ''}" title="Pecah Kata"><i class="fa-solid fa-scissors"></i></button>
                  <button onclick="refreshMessage(${idx})" title="Refresh"><i class="fa-solid fa-rotate"></i></button>
                  <button onclick="playDummyAudio(this)" title="Suara"><i class="fa-solid fa-volume-high"></i></button>
                  <button onclick="openAskLetaModal()" title="Tanya Leta"><i class="fa-solid fa-robot"></i></button>
                </div>
                <span class="time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", aiHtml);
    }
  });
  
  // Auto-scroll ke paling bawah obrolan
  container.scrollTop = container.scrollHeight;
}

// Simulasi balasan Persona AI
function triggerAiResponse() {
  if (!activePersonaId) return;
  const p = window.personasData.find(x => x.id === activePersonaId);
  if (!p) return;
  
  const lang = p.language || "jp";
  const sourceList = DUMMY_RESPONSES[lang] || [];
  
  // Ambil respons secara acak
  const randomResp = sourceList[Math.floor(Math.random() * sourceList.length)];
  
  messagesData[activePersonaId].push({
    sender: "ai",
    text: randomResp.text,
    translation: randomResp.translation,
    tokens: JSON.parse(JSON.stringify(randomResp.tokens)), // Deep copy tokens
    isPecah: false,
    isTranslate: false
  });
  
  renderActiveMessages();
}

// Aksi: Terjemahan
window.toggleTranslate = function(msgIdx) {
  const m = messagesData[activePersonaId][msgIdx];
  if (m) {
    m.isTranslate = !m.isTranslate;
    renderActiveMessages();
  }
};

// Aksi: Pecah Kata
window.togglePecahKata = function(msgIdx) {
  const m = messagesData[activePersonaId][msgIdx];
  if (m) {
    m.isPecah = !m.isPecah;
    renderActiveMessages();
  }
};

// Aksi: Refresh respons
window.refreshMessage = function(msgIdx) {
  const p = window.personasData.find(x => x.id === activePersonaId);
  if (!p) return;
  const lang = p.language || "jp";
  const sourceList = DUMMY_RESPONSES[lang] || [];
  
  const randomResp = sourceList[Math.floor(Math.random() * sourceList.length)];
  messagesData[activePersonaId][msgIdx] = {
    sender: "ai",
    text: randomResp.text,
    translation: randomResp.translation,
    tokens: JSON.parse(JSON.stringify(randomResp.tokens)),
    isPecah: false,
    isTranslate: false
  };
  renderActiveMessages();
  showToast("Respons berhasil dimuat ulang.", "success");
};

// Aksi: Suara (dummy highlight)
window.playDummyAudio = function(btn) {
  btn.style.color = "var(--success)";
  showToast("Memutar audio percakapan...", "info");
  setTimeout(() => {
    btn.style.color = "";
  }, 1500);
};

// Aksi: Buka Modal Tanya Leta
window.openAskLetaModal = function() {
  // Reset input dan answer
  document.getElementById("leta-question").value = "";
  document.getElementById("leta-answer-box").classList.add("hidden");
  openModal('modal-tanya-leta');
};

// POPOVER WORD CARD CONTROLLER
window.openWordCard = function(msgIdx, tokenIdx) {
  const m = messagesData[activePersonaId][msgIdx];
  if (!m || !m.tokens) return;
  
  activeWordCardTokens = m.tokens;
  activeWordCardIndex = tokenIdx;
  
  updateWordCardUI();
  document.getElementById("popover-word-card").classList.remove("hidden");
};

window.closeWordCard = function() {
  document.getElementById("popover-word-card").classList.add("hidden");
};

function updateWordCardUI() {
  const token = activeWordCardTokens[activeWordCardIndex];
  if (!token) return;
  
  document.getElementById("word-card-title").textContent = token.word;
  document.getElementById("word-card-reading").textContent = token.reading || "-";
  document.getElementById("word-card-meaning").textContent = token.meaning || "-";
  document.getElementById("word-card-index").textContent = `${activeWordCardIndex + 1} / ${activeWordCardTokens.length}`;
  
  // Set Bintang Active / Inactive
  const btnStar = document.getElementById("btn-star-word");
  if (token.isStarred) {
    btnStar.classList.add("active");
    btnStar.innerHTML = `<i class="fa-solid fa-star"></i>`;
  } else {
    btnStar.classList.remove("active");
    btnStar.innerHTML = `<i class="fa-regular fa-star"></i>`;
  }
}

// Handler Navigasi & Bintang pada Word Card
const btnStarWord = document.getElementById("btn-star-word");
const btnWordPrev = document.getElementById("btn-word-prev");
const btnWordNext = document.getElementById("btn-word-next");

if (btnStarWord) {
  btnStarWord.addEventListener("click", () => {
    const token = activeWordCardTokens[activeWordCardIndex];
    if (token) {
      token.isStarred = !token.isStarred;
      updateWordCardUI();
      if (token.isStarred) {
        showToast(`Kata "${token.word}" disimpan ke glosarium!`, "success");
      } else {
        showToast(`Mengeluarkan "${token.word}" dari glosarium.`, "info");
      }
    }
  });
}

if (btnWordPrev) {
  btnWordPrev.addEventListener("click", () => {
    if (activeWordCardIndex > 0) {
      activeWordCardIndex--;
      updateWordCardUI();
    }
  });
}

if (btnWordNext) {
  btnWordNext.addEventListener("click", () => {
    if (activeWordCardIndex < activeWordCardTokens.length - 1) {
      activeWordCardIndex++;
      updateWordCardUI();
    }
  });
}

// ==========================================
// LOGIKA MODAL PENGATURAN (BIODATA)
// ==========================================
const btnSettings = document.getElementById("btn-settings");
const formBiodata = document.getElementById("form-biodata");

if (btnSettings) {
  btnSettings.addEventListener("click", () => {
    // Populate form fields
    const profile = window.userProfile || {
      name: "",
      gender: "",
      age: "",
      native_language: "Indonesia",
      language_weakness: "Belum terdeteksi kelemahan spesifik."
    };

    document.getElementById("profile-name").value = profile.name || "";
    document.getElementById("profile-gender").value = profile.gender || "";
    document.getElementById("profile-age").value = profile.age || "";
    document.getElementById("profile-native").value = "Indonesia";
    document.getElementById("profile-weakness").value = profile.language_weakness || "Belum terdeteksi kelemahan spesifik.";

    openModal("modal-settings");
  });
}

if (formBiodata) {
  formBiodata.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase) {
      alert("Supabase belum terhubung!");
      return;
    }

    const sessionData = await supabase.auth.getSession();
    const user = sessionData.data.session?.user;
    if (!user) {
      alert("Anda harus login untuk menyimpan biodata.");
      return;
    }

    const btnSubmit = formBiodata.querySelector("button[type='submit']");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Menyimpan...";

    const name = document.getElementById("profile-name").value.trim();
    const gender = document.getElementById("profile-gender").value;
    const ageVal = document.getElementById("profile-age").value;
    const age = ageVal ? parseInt(ageVal) : null;

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          name,
          gender,
          age
        })
        .eq("id", user.id);

      if (error) throw error;

      // Update local state
      if (window.userProfile) {
        window.userProfile.name = name;
        window.userProfile.gender = gender;
        window.userProfile.age = age;
      }

      showToast("Biodata berhasil diperbarui!", "success");
      closeModal("modal-settings");
    } catch (err) {
      console.error(err);
      alert("Gagal memperbarui biodata: " + err.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Simpan Biodata";
    }
  });
}

// Handler Tab Kiri modal-settings
document.querySelectorAll("#modal-settings .settings-tab-btn").forEach(btn => {
  btn.addEventListener("click", function() {
    // Remove active from all tabs
    document.querySelectorAll("#modal-settings .settings-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#modal-settings .settings-tab-pane").forEach(pane => pane.classList.add("hidden"));
    
    // Add active to current
    this.classList.add("active");
    const tabId = this.getAttribute("data-tab");
    const pane = document.getElementById(tabId);
    if (pane) pane.classList.remove("hidden");
  });
});

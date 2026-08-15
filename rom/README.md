# ROM (Router & Orchestrator Microservice) Admin Portal

Proyek ini adalah *microservice* router dan orkestrator yang dikhususkan untuk mengelola LLM gratisan/free tier (seperti Gemini, Groq, SambaNova, Together, dll.) secara cerdas, aman, dan tanpa pemborosan kuota.

Fase 1 ini memuat **Dashboard Administrator (SPA)** untuk mengelola penyedia API Key, pendaftaran model beserta batas metriknya, dan pembuatan scope tugas serta prioritas pemanggilan model.

---

## Struktur Folder Proyek
* `src/server.ts` : File utama server Fastify, menyediakan REST API untuk Dashboard & serving static files.
* `src/db.ts` : Modul koneksi pooler PostgreSQL Supabase dengan penanganan **Boot Connection Retry** otomatis.
* `src/utils/crypto.ts` : Helper enkripsi API Keys menggunakan algoritma **AES-256-GCM** yang aman.
* `public/` : Folder aset statis Dashboard SPA (HTML, CSS, JS).
  * `public/login.html` : Halaman login administrator (Username: `asadiabdullah`, Password: `101190029`).
  * `public/dashboard.html` : Panel SPA utama (Overview, Kelola Provider, Kelola Model, Kelola Scope).
  * `public/style.css` : Gaya premium bertema Putih, Hijau, Biru.
  * `public/app.js` : Logika SPA AJAX untuk berinteraksi dengan API Server.
* `schema.sql` : Skema struktur tabel database Supabase PostgreSQL.

---

## Cara Menjalankan Secara Lokal

1. **Pastikan Dependensi Terinstal:**
   ```bash
   npm install
   ```

2. **Jalankan Inisialisasi Database:**
   Skrip `init-db.js` akan membaca berkas `.env` dan mengeksekusi `schema.sql` langsung ke database Supabase Anda.
   ```bash
   node init-db.js
   ```

3. **Jalankan Server dalam Mode Development:**
   ```bash
   npm run dev
   ```
   Server akan berjalan di `http://localhost:3000`.
   Buka halaman login di: [http://localhost:3000/dashboard/login.html](http://localhost:3000/dashboard/login.html)

---

## Cara Integrasi ke Aplikasi Utama (`learntalk`)

Karena microservice ini dirancang mandiri, Anda memiliki dua cara untuk menyatukannya dengan proyek utama `learntalk`:

### Pendekatan 1: Microservice Terpisah (Sangat Direkomendasikan)
* Biarkan folder `rom` berjalan mandiri pada port tersendiri (misal: port `3000` untuk ROM, dan port `8000` untuk `learntalk`).
* Aplikasi `learntalk` cukup menembak REST API proksi ke ROM untuk pemanggilan LLM.

### Pendekatan 2: Penggabungan Aset Publik
Jika Anda ingin agar Dashboard Administrator ROM disajikan langsung oleh server publik aplikasi utama `learntalk`:
1. Salin seluruh konten dari folder `G:\learntalk\rom\public\` ke folder aset publik aplikasi `learntalk` Anda (misalnya ke `G:\learntalk\public\rom-admin\`).
2. Sesuaikan pemanggilan endpoint `fetch()` pada berkas `app.js` di frontend agar menembak ke URL absolut microservice ROM Anda (contoh: `http://localhost:3000/api/...` alih-alih `/api/...`).

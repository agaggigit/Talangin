# Dokumentasi Library Proyek (Utang Tracker)

Dokumen ini merangkum seluruh _library_ pihak ketiga (dependencies) yang kita gunakan di dalam aplikasi ini, baik di sisi **Frontend (React)** maupun **Backend (Express)**.

---

## 🎨 1. Frontend (React / Vite)

Berikut adalah daftar library utama yang berjalan di sisi pengguna (browser).

### Inti Aplikasi (Core)
*   **`react` & `react-dom`**
    *   **Fungsi:** Kerangka kerja (framework) utama untuk membangun antarmuka pengguna (UI).
    *   **Alasan:** React adalah standar industri modern untuk membuat aplikasi web yang interaktif, reaktif, dan berbasis komponen.
*   **`react-router-dom`**
    *   **Fungsi:** Mengatur navigasi (pindah halaman) di dalam aplikasi.
    *   **Alasan:** Memungkinkan aplikasi berjalan sebagai _Single Page Application (SPA)_. Pengguna bisa berpindah dari halaman Dashboard ke halaman Profil tanpa perlu memuat ulang (refresh) keseluruhan halaman web, sehingga terasa sangat cepat.

### Pemrosesan Data & API (Data Fetching)
*   **`axios`**
    *   **Fungsi:** Mengirim permintaan HTTP (GET, POST, PATCH, dll) ke backend.
    *   **Alasan:** Lebih mudah digunakan dibandingkan `fetch` bawaan browser. Axios secara otomatis mengubah data menjadi JSON, menangani error dengan rapi, dan memungkinkan kita membuat _interceptor_ (seperti menyisipkan token JWT secara otomatis di setiap request).
*   **`@tanstack/react-query`**
    *   **Fungsi:** Mengelola _server state_ (data dari API), menyediakan fitur *loading*, *error handling*, dan *caching*.
    *   **Alasan:** Menggantikan `useEffect` dan `useState` tradisional yang berantakan. React Query membuat aplikasi lebih hemat kuota karena tidak menembak API berulang kali untuk data yang sama (*caching*), serta membuat kode jauh lebih bersih.

### Antarmuka & Pengalaman Pengguna (UI/UX)
*   **`lucide-react`**
    *   **Fungsi:** Menyediakan kumpulan ikon (seperti tombol panah, ikon hapus, gembok).
    *   **Alasan:** Desain ikonnya modern, ukurannya ringan (hanya me-load ikon yang dipakai saja), dan sangat mudah dikustomisasi (warna dan ukuran) melalui *props* React.
*   **`react-hot-toast`**
    *   **Fungsi:** Menampilkan notifikasi kecil di pojok layar (toast) seperti "Data berhasil disimpan".
    *   **Alasan:** Sangat ringan, mudah digunakan, desain bawaannya elegan, dan animasinya mulus.
*   **`sweetalert2` & `sweetalert2-react-content`**
    *   **Fungsi:** Menampilkan _popup modal_ interaktif (misalnya untuk konfirmasi "Apakah Anda yakin ingin menghapus?").
    *   **Alasan:** Jauh lebih cantik dan interaktif daripada `window.confirm()` bawaan browser.

### Autentikasi
*   **`@react-oauth/google`**
    *   **Fungsi:** Menyediakan tombol khusus dan logika untuk "Login dengan Google".
    *   **Alasan:** Mempermudah implementasi integrasi login Google di React tanpa harus berurusan manual dengan *script* Google Identity yang rumit.

### PWA
*   **`vite-plugin-pwa` & `workbox-window`**
    *   **Fungsi:** Mengubah aplikasi web menjadi *Progressive Web App* (PWA) agar bisa di-install di HP seperti aplikasi native.

---

## ⚙️ 2. Backend (Node.js / Express)

Berikut adalah daftar library utama yang berjalan di server (di belakang layar).

### Inti Server & Database
*   **`express`**
    *   **Fungsi:** Kerangka kerja utama untuk membuat API dan mengatur rute (misal `/users/me`).
    *   **Alasan:** Standar industri, sangat stabil, dokumentasinya melimpah, dan ringan.
*   **`@prisma/client` & `@prisma/adapter-pg`**
    *   **Fungsi:** Bertindak sebagai ORM (Object-Relational Mapping). Alat untuk berinteraksi dengan database PostgreSQL.
    *   **Alasan:** Prisma sangat disukai karena memiliki *auto-complete* TypeScript yang luar biasa aman. Kita tidak perlu menulis query SQL manual (`SELECT * FROM...`), cukup memakai sintaks JavaScript yang mudah dibaca (`prisma.user.findUnique()`).
*   **`pg`**
    *   **Fungsi:** Driver penghubung (konektor) antara Node.js dan database PostgreSQL.
    *   **Alasan:** Library wajib agar Prisma bisa berbicara secara langsung dengan server PostgreSQL.

### Autentikasi & Keamanan
*   **`jsonwebtoken`**
    *   **Fungsi:** Membuat dan memvalidasi "tiket" (Token JWT).
    *   **Alasan:** JWT adalah standar modern untuk sesi pengguna pada aplikasi API. Setelah user login, server memberikan JWT ini, dan user menggunakannya sebagai "paspor" untuk mengakses data rahasianya.
*   **`bcryptjs`**
    *   **Fungsi:** Mengacak (hashing) password.
    *   **Alasan:** Kita dilarang menyimpan password mentah (misal: "password123") di database. Bcrypt mengubahnya menjadi string acak rahasia. Jika database bocor, password user tetap aman.
*   **`google-auth-library`**
    *   **Fungsi:** Memverifikasi keaslian login Google dari sisi server.
    *   **Alasan:** Mencegah user memalsukan akun Google-nya. Saat frontend mengirim kredensial Google, library ini memastikan bahwa kredensial tersebut benar-benar diterbitkan oleh server Google.
*   **`cors`**
    *   **Fungsi:** Mengatur kebijakan *Cross-Origin Resource Sharing*.
    *   **Alasan:** Karena frontend (port 5173) dan backend (port 3000) berada di alamat yang berbeda, browser secara default akan memblokir komunikasi keduanya demi keamanan. CORS dipasang di backend agar memperbolehkan frontend mengakses API-nya.

### Validasi & File Upload
*   **`zod`**
    *   **Fungsi:** Memvalidasi bentuk data yang dikirim oleh pengguna (schema validation).
    *   **Alasan:** Menjaga keamanan server dari data yang rusak/salah. Zod akan otomatis mengecek apakah input email formatnya benar, password minimal 6 karakter, dll.
*   **`multer`** (Dalam Perencanaan)
    *   **Fungsi:** Memproses *form data* yang berisi file gambar.
    *   **Alasan:** Express secara bawaan hanya mengerti teks/JSON. Untuk mengunggah foto profil asli, kita menggunakan `multer` untuk menerima file tersebut dan menyimpannya.

---

> **Tip:** Semua *library* ini didefinisikan dalam file `package.json` di masing-masing folder (`frontend/package.json` dan `backend/package.json`). Perintah `npm install` akan membaca file tersebut untuk mengunduh semua perlengkapan ini.

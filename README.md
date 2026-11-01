# Talangin
**A PWA Bill Splitter & Debt Tracker for Friend Groups**

Aplikasi ini adalah platform pencatatan utang (patungan) yang dirancang khusus untuk sirkel pertemanan yang suka lupa utang satu sama lain. Aplikasi ini dibuat simpel dan minim fitur kompleks, sehingga *user* dapat dengan mudah menavigasinya. Aplikasi ini juga mendukung *Progressive Web App* (PWA), sehingga bisa di-install di HP seperti aplikasi native.

---

## Main Features

- **Sirkel (Group Management):** Fitur untuk membuat dan bergabung dengan kelompok pertemanan/patungan. Undang teman menggunakan kode rahasia unik (beserta fitur *Admin Approval*). Di dalam Sirkel inilah riwayat transaksi akan berlangsung.
- **Chronological Feed:** Riwayat transaksi dibuat mirip *feeds social media* dengan sistem *infinite scroll* (dapat digulir sampai ujung transaksi paling awal), sehingga sangat mudah dan intuitif untuk dipantau.
- **Smart Calculator:** Kamu tidak perlu bolak-balik buka aplikasi kalkulator. Form input nominal mendukung operasi hitung-hitungan langsung (contoh: ketik `50000+15000` di kolom input).
- **Auto-Accumulation:** Informasi penting seperti total utang yang tersisa, total yang sudah dibayar, dan saldo akhir akan langsung diakumulasi. *User* tidak perlu capek menghitung manual.
- **Corporate & Clean UI:** Tampilan bergaya *modern banking* (ala Livin') yang bersih dan elegan, dilengkapi dengan notifikasi halus (*React Hot Toast*) dan popup (*SweetAlert2*).
- **Lunasi Selisih (Settle Up):** Aku utang 50rb ke Budi, Budi utang 30rb ke aku? Cukup **satu transfer 20rb**. Semua tagihan dua arah di antara kalian langsung tertutup setelah Budi mengonfirmasi.
- **Saran Transfer Grup:** Penyederhanaan utang ala Splitwise. Aplikasi menghitung jumlah transfer paling sedikit untuk melunasi seluruh utang di grup (maksimal *n − 1* transfer untuk *n* orang).
- **Notification:** Sistem notifikasi terpusat untuk memberitahu jika ada tagihan baru atau jika utang telah dilunasi.
- **Profile:** Profil yang dapat dikustomisasi, terintegrasi dengan Google Login (OAuth).

---

## Tech Stack

### Frontend & PWA Layer
- **Core Framework:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS. Semua warna kustom diatur menggunakan **format RGB dengan sintaks `<alpha-value>`** agar mendukung *opacity modifier* (contoh: `bg-primary/50`).
- **Icons:** Lucide React
- **PWA Builders:** Vite PWA
- **Server State Management:** TanStack Query (React Query) untuk *caching* data dari API dan sinkronisasi otomatis.
- **Custom Hooks Architecture:** Semua logika *fetching* API dan mutasi data **wajib dipisahkan** dari komponen UI (Presentational) dan dienkapsulasi di dalam folder `src/hooks`. Tidak boleh ada halaman yang menjadi *Fat Component*.
- **UX Enhancements:** React Hot Toast & SweetAlert2 (Notifikasi & Popup)

### Backend & API Layer
- **Runtime Environment:** Node.js
- **Web Framework:** Express.js + TypeScript
- **Architecture Style:** Vertical Slice Architecture
- **Authentication:** JWT (JSON Web Tokens) & Google OAuth
- **Validation:** Zod

### Database & Storage
- **Database Utama:** PostgreSQL
- **ORM:** Prisma

---

## Engineering Highlights

### 1. Skema pembayaran: satu transfer, banyak tagihan
Awalnya `Payment` terikat ke satu `ExpenseShare`, jadi melunasi selisih harus dilakukan per tagihan. Sekarang relasinya dipindah ke tabel penghubung **`payment_allocations`** (`payment_id`, `expense_share_id`, `amount`, `active`). Satu `Payment` mencatat uang yang benar-benar ditransfer (selisih bersih), sedangkan alokasinya mencatat share mana saja yang ikut lunas, termasuk share yang arahnya berlawanan.

Migrasi datanya (`prisma/migrations/20261101000100_payment_allocations`) memindahkan setiap payment lama menjadi satu alokasi, lalu membersihkan duplikat sisa race condition lama sebelum constraint baru dipasang.

### 2. Race condition ditutup di level database, bukan di kode
- **Pengajuan ganda.** Pola "cek dulu apakah ada yang pending, baru insert" selalu punya celah di antara cek dan insert. Sekarang ada **partial unique index** `ON payment_allocations(expense_share_id) WHERE active`: satu share hanya boleh tercakup oleh satu pembayaran yang belum ditolak. Insert kedua pasti ditolak Postgres dan diterjemahkan menjadi HTTP 409.
- **Approve/reject bersamaan.** Memakai update bersyarat (`updateMany ... WHERE status = 'pending'`) di dalam transaksi, lalu mengecek jumlah baris yang berubah. Dari beberapa request yang datang bersamaan, hanya satu yang mendapat `count = 1`.
- Keduanya dibuktikan dengan **tes integrasi yang mengirim request paralel** ke Postgres sungguhan (`src/payments/payments.integration.test.ts`).

### 3. Algoritma penyederhanaan utang
`src/groups/simplifyDebts.ts` menghitung saldo bersih tiap orang, lalu secara *greedy* memasangkan pengutang terbesar dengan penerima terbesar. Setiap langkah membuat minimal satu orang saldonya nol, sehingga hasilnya paling banyak *n − 1* transfer (kompleksitas O(n log n)). Mencari jumlah transfer yang benar-benar minimum adalah masalah NP-hard (bisa direduksi dari *subset-sum*), jadi greedy ini adalah aproksimasi standar yang dipakai di praktik.

### 4. Uang dihitung dalam sen (integer)
`0.1 + 0.2 !== 0.3` di JavaScript. Semua penjumlahan saldo dikonversi ke sen (integer) dulu (`src/lib/money.ts`), lalu baru dikembalikan ke rupiah di batas keluar.

---

## Testing

```bash
cd backend
npm test                  # unit test: balance, settle up, simplifyDebts
npm run test:integration  # alur pelunasan + race condition, butuh Postgres lokal (lihat di bawah)
```

---

## Standardisasi Kode (Code Conventions)

> [!IMPORTANT]
> Kontributor yang ingin berpartisipasi diharapkan mematuhi aturan berikut:

1. **Strict Null Checks (TypeScript)**: TypeScript dikonfigurasi sangat ketat. Hindari penggunaan tipe `any`. Gunakan **Optional Chaining (`?.`)** dan **Nullish Coalescing (`??`)** untuk memastikan aplikasi tidak *crash* jika menemukan data *undefined*.
2. **Error Handling Terpusat**: Semua penanganan *error* dari API **wajib** diproses menggunakan fungsi pembantu `getErrorMessage` yang ada di `frontend/src/utils/errorHandler.ts` agar pesan error tampil seragam.
3. **Pemisahan Logika (Separation of Concerns)**: Komponen UI (React Component) hanya bertugas untuk **merender tampilan**. Logika bisnis, _fetching_, dan pengiriman formulir diserahkan sepenuhnya kepada *Custom Hooks*.

---

## Prerequisites

Sebelum menjalankan proyek ini, pastikan sistem kamu memiliki:
- **Node.js** (versi 18 atau lebih baru)
- **Docker Desktop** (untuk PostgreSQL lokal), atau PostgreSQL yang terinstal sendiri
- **Git**

---

## How to run for yourself in localhost

### 1. Clone Repositories
```bash
git clone https://github.com/agaggigit/utang-tracker-sirkel.git
cd utang-tracker-sirkel
```

### 2. Setup Backend
Masuk ke folder `backend`, instal dependensi, atur variabel lingkungan (*environment*), dan jalankan *database migration*.
```bash
cd backend
npm install

# Jalankan PostgreSQL lokal (port 5433)
docker compose up -d

# Buat file .env dari .env.example (DATABASE_URL sudah mengarah ke Postgres lokal)
cp .env.example .env

# Terapkan semua migration ke database lokal
npx prisma migrate deploy

# Jalankan server (default port 3000, bisa diubah lewat env PORT)
npm run dev
```

### 3. Setup Frontend
Buka terminal baru, masuk ke folder `frontend`, instal dependensi, lalu jalankan.
```bash
cd frontend
npm install

# Jalankan Vite server (biasanya akan berjalan di port 5173)
npm run dev
```

Aplikasi siap diakses melalui `http://localhost:5173` di *browser* kamu!

---

## 🧪 Testing Account & Group

Gunakan akun berikut jika kamu ingin langsung menguji coba tanpa perlu registrasi ulang:

#### Account 1
- **Email:** `test01@test01.com`
- **Password:** `test01@@`

#### Account 2
- **Email:** `test02@test02.com`
- **Password:** `test02@@`

#### Account 3
- **Email:** `test03@test03.com`
- **Password:** `test03@@`

#### Account 4
- **Email:** `test04@test04.com`
- **Password:** `test04@@`

#### Account 5
- **Email:** `testhp@testhp.com`
- **Password:** `testhp@@`

#### Group 1 (Contoh Data)
- **Host:** Login menggunakan Akun Google Pribadi
- **Name:** Sirkel1NoHostPerm
- **Code:** `07a372cb`

#### Group 2 (Contoh Data)
- **Host:** testhp
- **Name:** Nyoba di hp
- **Code:** `b2d5513c`

---

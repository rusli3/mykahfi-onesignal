# MyKahfi-WEB

Portal Wali Murid SIT Al Kahfi — Aplikasi web untuk cek pembayaran, pesan sekolah, dan notifikasi push (OneSignal) yang di-deploy di Vercel.

> Dibangun sebagai pendamping aplikasi Android, agar pengguna iPhone dan pengguna Android tanpa akses Play Store tetap mendapatkan pengalaman yang setara.

## ✨ Fitur

- **Login** — NIS/VA + Password, session aman (httpOnly cookie)
- **Dashboard Pembayaran** — Grid bulan akademik (AGU–JUN) dengan status Lunas/Belum
- **Detail Transaksi** — Modal: bulan, nominal, tanggal, jenjang, ID transaksi
- **Pesan Sekolah** — Badge "Baru", link otomatis clickable
- **Cara Pembayaran** — Panduan langkah + kontak admin WhatsApp (tap-to-chat)
- **Push Notification** — OneSignal web push untuk iOS (PWA) & Android Chrome
- **PWA Support** — Install ke Home Screen dengan panduan untuk iOS & Android

## 🛠 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Bahasa | TypeScript |
| Database | Supabase (shared dengan Android) |
| Auth Session | iron-session (httpOnly cookie) |
| Push Notification | OneSignal Web SDK |
| Hosting | Vercel |
| Arsitektur | BFF (Backend-for-Frontend) |

## 📁 Struktur Project

```
src/
├── app/
│   ├── layout.tsx              # Root layout + PWA metadata
│   ├── page.tsx                # Redirect → /login
│   ├── globals.css             # Design system
│   ├── login/page.tsx          # Halaman login
│   ├── dashboard/page.tsx      # Halaman dashboard
│   └── api/
│       ├── auth/login/         # POST  - Login
│       ├── auth/logout/        # POST  - Logout
│       ├── dashboard/          # GET   - Data dashboard
│       ├── push/register-device/ # POST - Daftarkan device push
│       └── messages/mark-read/ # POST  - Tandai pesan dibaca
├── components/
│   ├── MonthCard.tsx           # Card status bulan
│   ├── TransactionDetail.tsx   # Modal detail transaksi
│   ├── SchoolMessage.tsx       # Pesan sekolah
│   ├── PaymentGuide.tsx        # Panduan bayar + kontak WA
│   ├── PWAInstallPrompt.tsx    # Banner install PWA
│   └── OneSignalInit.tsx       # Inisialisasi OneSignal SDK
├── lib/
│   ├── supabase.ts             # Supabase client (server-side)
│   ├── session.ts              # Manajemen session
│   └── onesignal.ts            # OneSignal REST API helper
├── proxy.ts                    # Proteksi route
└── ../scripts/
    └── migrate-passwords.mjs   # Migrasi password plaintext -> bcrypt
```

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Setup environment variables

Salin template dan isi dengan credentials Anda:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Client-safe
NEXT_PUBLIC_APP_NAME=MyKahfi-WEB
NEXT_PUBLIC_ONESIGNAL_APP_ID=<dari OneSignal dashboard → Settings → Keys & IDs>
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co

# Server-only (RAHASIA — jangan commit!)
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_ANON_KEY=<dari Supabase → Settings → API → anon key>
SUPABASE_SERVICE_ROLE_KEY=<dari Supabase → Settings → API → service_role key>
ONESIGNAL_REST_API_KEY=<dari OneSignal dashboard → Settings → Keys & IDs>
SUPABASE_WEBHOOK_SECRET=<shared secret untuk webhook DB -> Vercel>
SESSION_SECRET=<random string 32+ karakter, generate: openssl rand -base64 32>
APP_ENV=development
```

### 3. Setup database (jika belum)

Jalankan SQL di **Supabase SQL Editor** untuk membuat tabel baru:

```bash
# File: sql/create_tables.sql
```

Tabel yang dibuat:
- `user_devices_web` — data device web untuk push notification
- `notification_logs` — log pengiriman notifikasi
- `user_login_audit` — audit trail login (jika belum ada)

Aktifkan trigger notifikasi pesan sekolah (`users.msg_app`) dengan SQL berikut:
- `sql/enable_msg_app_trigger.sql`
- Ganti placeholder `<VERCEL_APP_URL>` dan `<SUPABASE_WEBHOOK_SECRET>` sebelum execute.

### 4. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

### 5. Migrasi password legacy (wajib untuk hardening auth)

Dry run dulu (tanpa update data):

```bash
npm run migrate:passwords -- --dry-run
```

Eksekusi migrasi:

```bash
npm run migrate:passwords
```

Opsi tambahan:
- `--batch-size 200` (default `200`)
- `--limit 1000` (batasi jumlah akun yang diproses per eksekusi)

## 🔑 Cara Mendapatkan API Keys

### Supabase
1. Buka [supabase.com](https://supabase.com) → project Anda
2. **Settings** → **API**
3. Salin: `Project URL`, `anon key`, `service_role key`

### OneSignal
1. Buka [onesignal.com](https://onesignal.com) → buat app baru (Web Push)
2. **Settings** → **Keys & IDs**
3. Salin: `App ID`, `REST API Key`

### Session Secret
```bash
openssl rand -base64 32
```

## 📱 Push Notification (iOS)

Web push di iOS memerlukan:
- iOS **16.4+**
- Aplikasi di-install sebagai **PWA** (Add to Home Screen)
- User memberikan **izin notifikasi**

Alur untuk pengguna:
1. Buka web MyKahfi-WEB di Safari
2. Tap **Share** → **Add to Home Screen**
3. Buka app dari Home Screen
4. Izinkan notifikasi saat diminta

## 🌐 Deploy ke Vercel

```bash
# Install Vercel CLI (jika belum)
npm i -g vercel

# Deploy
vercel deploy
```

Atau connect repository Git ke [vercel.com](https://vercel.com) untuk auto-deploy.

**Penting:** Set semua environment variables di Vercel dashboard → **Settings** → **Environment Variables**.

## 📋 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login NIS/Password |
| POST | `/api/auth/logout` | Logout & clear session |
| GET | `/api/dashboard` | Data dashboard (protected) |
| POST | `/api/push/register-device` | Registrasi device push |
| POST | `/api/push/notify-message` | Webhook internal perubahan `users.msg_app` |
| POST | `/api/messages/mark-read` | Tandai pesan dibaca |

## 🔒 Keamanan

- Session menggunakan **httpOnly cookie** (tidak bisa diakses JavaScript di browser)
- `SESSION_SECRET` wajib terisi (minimal 32 karakter), aplikasi akan fail-fast jika tidak valid
- Semua data diakses melalui **BFF route** (browser tidak akses Supabase langsung)
- `SUPABASE_SERVICE_ROLE_KEY` hanya ada di server — tidak pernah expose ke client
- Login sudah menggunakan **bcrypt hash** (kompatibel migrasi dari data plaintext lama)
- Endpoint login dilindungi **rate limit** untuk mengurangi brute-force
- Route `/dashboard` dan API dilindungi **proxy** — redirect ke login jika session expired

## 📄 Lisensi

Private — SIT Al Kahfi

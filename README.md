# MyKahfi-WEB

Portal wali murid SIT Al Kahfi untuk:
- Login siswa
- Melihat status pembayaran bulanan (AGU-JUN)
- Melihat detail transaksi
- Membaca pesan sekolah

## Fitur
- Login NIS/VA + password
- Validasi NIS/VA wajib 6 digit angka
- Opsi lihat/sembunyikan password (ikon mata)
- Opsi ingat NIS/VA di perangkat
- Dashboard pembayaran per bulan akademik
- Modal detail pembayaran
- Modal cara pembayaran + kontak WhatsApp admin
- PWA install prompt

## Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Supabase (server-side via BFF routes)
- iron-session (cookie session)
- Deploy target: Vercel

## Struktur Utama
```text
src/
  app/
    api/
      auth/login/route.ts
      auth/logout/route.ts
      dashboard/route.ts
    dashboard/page.tsx
    login/page.tsx
    layout.tsx
    globals.css
  components/
    MonthCard.tsx
    TransactionDetail.tsx
    SchoolMessage.tsx
    PaymentGuide.tsx
    PWAInstallPrompt.tsx
  lib/
    supabase.ts
    session.ts
    rate-limit.ts
  proxy.ts
sql/
  create_tables.sql
```

## Setup Lokal
1. Install dependency
```bash
npm install
```

2. Siapkan `.env.local`
```env
NEXT_PUBLIC_APP_NAME=MyKahfi-WEB
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co

SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SESSION_SECRET=<32+ karakter random>
APP_ENV=development
```

3. Siapkan database
- Jalankan `sql/create_tables.sql` di Supabase SQL Editor.

4. Jalankan app
```bash
npm run dev
```

## API
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/dashboard`

## Catatan Keamanan
- Session disimpan di cookie `httpOnly`.
- Route `/dashboard` diproteksi di `src/proxy.ts`.
- Login dibatasi rate-limit per IP+NIS.
- Sesuai keputusan saat ini, verifikasi password berjalan dengan perbandingan plaintext di server terhadap data `users.password`.

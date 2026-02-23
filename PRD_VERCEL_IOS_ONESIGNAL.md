# PRD: MyKahfi Web (Vercel) untuk Pengguna iPhone + Push OneSignal

## 1. Ringkasan Produk

Membangun aplikasi web MyKahfi yang di-deploy di Vercel agar pengguna iPhone mendapatkan pengalaman yang setara dengan aplikasi Android saat ini: login, dashboard pembayaran bulanan, detail transaksi, pesan sekolah, panduan pembayaran, dan notifikasi push.

Target platform:
- iOS Safari (utama)
- PWA iOS (untuk pengalaman lebih app-like + web push)
- Browser modern lain sebagai fallback

## 2. Latar Belakang dan Masalah

Saat ini pengalaman utama ada di Android native. Pengguna iPhone belum memiliki channel resmi dengan UX dan notifikasi yang setara. Solusi web berbasis Vercel dipilih agar:
- time-to-market cepat,
- maintainability lebih baik,
- tidak perlu App Store native iOS pada fase awal.

## 3. Tujuan (Goals)

- Menyediakan pengalaman inti setara Android untuk wali murid di iPhone.
- Menyediakan push notification berbasis OneSignal untuk event penting (pembayaran dan pesan sekolah).
- Menjaga arsitektur terpisah dari project Android existing.
- Menjaga keamanan data (minimal setara implementasi saat ini, lalu ditingkatkan bertahap).

## 4. Non-Goals (Fase Ini)

- Tidak membangun aplikasi native iOS (Swift) pada fase ini.
- Tidak membangun full Supabase Auth migration pada fase awal jika model login NIS/Password masih dipertahankan.
- Tidak mengubah skema bisnis pembayaran inti.

## 5. Persona Utama

- Wali murid SIT Al Kahfi yang:
  - ingin cek status pembayaran cepat,
  - menerima notifikasi pembayaran/pesan sekolah,
  - memakai iPhone sebagai device utama.

## 6. Scope Fitur Fase 1 (MVP Production)

### 6.1 Login
- Login dengan `NIS/VA + Password`.
- Simpan sesi aman (httpOnly cookie/token strategy).
- Error message user-friendly (tanpa expose URL/query internal).

### 6.2 Dashboard Pembayaran
- Menampilkan bulan akademik (AGU–JUN) dengan status `Lunas/Belum`.
- Warna card bulan mengikuti palette yang sudah dipakai Android.
- Indikator alert untuk bulan berjalan/terlewat yang belum lunas.
- Pull-to-refresh / refresh manual.

### 6.3 Detail Transaksi
- Modal/detail view:
  - Bulan
  - Nominal
  - Tanggal
  - Jenjang
  - ID Transaksi

### 6.4 Pesan Sekolah
- Menampilkan pesan sekolah terbaru.
- Status “baru” untuk pesan belum dibaca.
- Link di dalam pesan clickable.

### 6.5 Cara Pembayaran + Kontak Admin
- Menampilkan instruksi pembayaran.
- Menampilkan kontak admin per unit.
- Tap-to-chat WhatsApp.

### 6.6 Push Notification (OneSignal)
- Notifikasi untuk:
  - pembayaran berhasil tercatat,
  - pesan sekolah baru.
- Segmentasi minimal berdasarkan `NIS` atau `external_user_id`.

## 7. Scope Fitur Fase 2 (Post-MVP)

- Biometrik/Face ID web-equivalent via WebAuthn/Passkeys.
- Inbox notifikasi dalam aplikasi web.
- Multi-device management untuk user.
- Analytics usage dashboard internal.

## 8. Kebutuhan Platform iOS dan Web Push

Catatan penting:
- Web push di iOS didukung mulai iOS 16.4+, dan paling ideal via PWA yang di-install ke Home Screen.
- User flow perlu edukasi singkat:
  1. buka web,
  2. Add to Home Screen,
  3. aktifkan notifikasi.

Acceptance minimum:
- Notifikasi berfungsi pada:
  - Safari iOS modern (sesuai dukungan OneSignal),
  - PWA terpasang.

## 9. Arsitektur Teknis (High-level)

### 9.1 Frontend
- Next.js (App Router) di Vercel.
- UI meniru sistem visual Android agar konsisten brand.
- PWA support (manifest, service worker, install prompt guidance).

### 9.2 Backend/Data
- Supabase tetap sebagai database utama.
- API access melalui server-side route handlers (BFF pattern) untuk mengurangi expose langsung dari client.

### 9.3 Notification Layer
- OneSignal sebagai provider push lintas platform.
- Event source:
  - Supabase triggers / Edge Functions (`notify-payment`, `notify-message`) mengirim ke OneSignal REST API.
- Mapping identity:
  - `external_id = nis` (proposal default).

## 10. Struktur Database (Detail Fase 1)

Web project menggunakan database Supabase yang sama dengan Android.

### 10.1 Tabel Existing (dipakai ulang)

- `users`
  - `nis` (text/varchar, unique) -> identity login user.
  - `password` (text) -> credential fase 1 (existing).
  - `nama_siswa` (text)
  - `jenjang` (text)
  - `msg_app` (text)
  - `fcm_token` (text) -> existing Android token (tetap dipertahankan).
  - `last_login_at` (timestamptz) -> sudah dipakai audit login.
  - `last_login_device` (text)
  - `last_login_app_version` (text)

- `transactions` (nama tabel menyesuaikan skema existing)
  - minimal field yang dibutuhkan web:
  - `idtrx`
  - `nis`
  - `bulan`
  - `nominal`
  - `tgl_trx`
  - `jenjang`

- `kontak_admin` (nama tabel menyesuaikan skema existing)
  - `unit`
  - `nohp`

### 10.2 Tabel Baru (wajib untuk web push OneSignal)

- `user_devices_web`
  - `id` bigint identity primary key
  - `nis` text not null
  - `onesignal_subscription_id` text not null
  - `external_id` text not null default `nis`
  - `platform` text not null (`ios_web`, `android_web`, `desktop_web`)
  - `is_active` boolean not null default true
  - `last_seen_at` timestamptz not null default now()
  - `created_at` timestamptz not null default now()
  - `updated_at` timestamptz not null default now()

- `notification_logs`
  - `id` bigint identity primary key
  - `nis` text not null
  - `event_type` text not null (`payment`, `message`)
  - `provider` text not null default `onesignal`
  - `status` text not null (`queued`, `sent`, `failed`)
  - `provider_message_id` text
  - `error_message` text
  - `payload` jsonb
  - `created_at` timestamptz not null default now()

- `user_login_audit` (sudah ditambahkan pada project Android, dipakai bersama)
  - `id` bigint identity primary key
  - `nis` text not null
  - `login_at` timestamptz not null
  - `device_name` text
  - `device_sdk` integer
  - `app_version` text
  - `login_source` text (`android_app`, `web_pwa`, `web_browser`)

### 10.3 Relasi dan Index

- Relasi logical:
  - `users.nis` -> `user_devices_web.nis`
  - `users.nis` -> `notification_logs.nis`
  - `users.nis` -> `user_login_audit.nis`

- Index minimal:
  - `idx_user_devices_web_nis` on `user_devices_web(nis)`
  - unique composite `uq_user_devices_web_subscription` on `(onesignal_subscription_id, platform)`
  - `idx_notification_logs_nis_created_at` on `notification_logs(nis, created_at desc)`
  - `idx_notification_logs_status` on `notification_logs(status)`
  - `idx_user_login_audit_nis_login_at` on `user_login_audit(nis, login_at desc)`

### 10.4 Baseline RLS/Policy (Fase 1)

- `users`:
  - read/update dari web dilakukan via BFF route di Vercel (service role di server-side), bukan direct dari browser.
- `user_devices_web`:
  - `insert/upsert` hanya via BFF route.
  - browser tidak diberi akses direct select penuh.
- `notification_logs`:
  - write hanya dari backend/edge function.
  - tidak ada akses client direct.
- `user_login_audit`:
  - insert-only untuk kebutuhan audit.
  - select untuk admin/reporting lewat backend.

### 10.5 SQL Draft (untuk tim backend)

```sql
create table if not exists public.user_devices_web (
  id bigint generated by default as identity primary key,
  nis text not null,
  onesignal_subscription_id text not null,
  external_id text not null,
  platform text not null check (platform in ('ios_web', 'android_web', 'desktop_web')),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_user_devices_web_subscription
  on public.user_devices_web (onesignal_subscription_id, platform);
create index if not exists idx_user_devices_web_nis
  on public.user_devices_web (nis);

create table if not exists public.notification_logs (
  id bigint generated by default as identity primary key,
  nis text not null,
  event_type text not null check (event_type in ('payment', 'message')),
  provider text not null default 'onesignal',
  status text not null check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_logs_nis_created_at
  on public.notification_logs (nis, created_at desc);
create index if not exists idx_notification_logs_status
  on public.notification_logs (status);
```

## 11. Keamanan dan Kepatuhan (Minimum)

- Semua secret disimpan di Vercel Environment Variables, bukan di repo.
- Rate limit endpoint login.
- Sanitasi error response.
- RLS review untuk tabel yang diakses web.
- Audit log login (lanjutkan konsep `last_login_at`, `device`, `app_version/web_version`).

## 12. Observability

- Sentry/Logtail (atau setara) untuk frontend + API route errors.
- Dashboard delivery push OneSignal.
- Metric minimum:
  - login success rate,
  - dashboard load success rate,
  - push opt-in rate iOS,
  - push delivery success rate.

## 13. KPI Keberhasilan

- >95% request dashboard sukses (non-timeout).
- Push opt-in iOS aktif >60% user aktif.
- Penurunan komplain “telat info pembayaran”.
- Tidak ada P1 security incident.

## 14. Milestone Rilis

### Milestone 1: Foundation (1-2 minggu)
- Setup repo terpisah.
- Setup Vercel project + env + Supabase connectivity.
- Auth login NIS/Password.

### Milestone 2: Core Experience (1-2 minggu)
- Dashboard, detail transaksi, pesan, cara bayar.
- UI parity dengan Android.

### Milestone 3: Push Notification (1 minggu)
- Integrasi OneSignal SDK web.
- Event bridge dari Supabase ke OneSignal.
- UAT notifikasi di iPhone.

### Milestone 4: Hardening + Go-live (1 minggu)
- Security pass, error handling, observability.
- Internal pilot + staged rollout.

## 15. Risiko Utama dan Mitigasi

- Risiko: keterbatasan iOS web push behavior.
  - Mitigasi: edukasi install PWA + fallback in-app message.
- Risiko: mismatch identity user antara DB dan OneSignal.
  - Mitigasi: standardisasi `external_id=nis` + validation layer.
- Risiko: latensi query direct ke Supabase dari client.
  - Mitigasi: BFF routes + caching selective.

## 16. Kriteria Penerimaan (Acceptance Criteria)

- User iPhone dapat login, melihat status bulan, membuka detail transaksi, dan membaca pesan tanpa error blocking.
- Push pembayaran dan pesan terkirim ke perangkat iPhone yang sudah opt-in.
- Tidak ada expose kredensial sensitif di frontend bundle.
- Error yang tampil ke user bersifat ramah dan non-teknis.

## 17. Konfirmasi yang Dibutuhkan

1. Apakah login fase 1 tetap `NIS/Password` (tanpa Supabase Auth) atau langsung migrasi ke Supabase Auth?
2. Untuk OneSignal identity, setuju `external_id = nis`?
3. Apakah web project dibuat di repo baru (direkomendasikan), mis. `my-kahfi-web`?
4. Domain production yang diinginkan (contoh: `app.mykahfi.id`)?
5. Apakah notifikasi harus real-time instan (<10 detik) atau cukup near-real-time (hingga 1 menit)?

Status: seluruh konfirmasi pada dokumen ini sudah dijawab dan dipindahkan ke bagian "Keputusan Terkonfirmasi".

## 18. Keputusan Terkonfirmasi

- Auth fase 1: tetap `NIS/Password`.
- Repository: web terpisah dari project Android, tetap memakai database Supabase yang sama.
- Domain production: domain standar Vercel.
- SLA push notification: mengikuti perilaku aplikasi saat ini (near-real-time).

### Catatan OneSignal `external_id` (penjelasan sederhana)

`external_id` adalah identitas unik user di OneSignal agar satu user bisa ditargetkan notifikasi secara konsisten lintas perangkat.

Rekomendasi fase 1:
- gunakan `external_id = nis`.

Alasan:
- paling sederhana untuk implementasi awal,
- selaras dengan model login saat ini (`NIS/Password`),
- memudahkan mapping dari event pembayaran/pesan ke user tujuan.

## 19. API Contract (Fase 1)

Semua endpoint berada di backend route project web (BFF), bukan direct dari browser ke tabel sensitif.

### 19.1 `POST /api/auth/login`
- Request:
```json
{ "nis": "231297", "password": "******" }
```
- Response 200:
```json
{ "ok": true, "user": { "nis": "231297", "nama_siswa": "..." } }
```
- Error:
  - `400` input invalid
  - `401` kredensial salah
  - `503` database/network timeout

### 19.2 `GET /api/dashboard?nis={nis}`
- Response 200:
```json
{
  "ok": true,
  "student": { "nis": "231297", "nama_siswa": "...", "jenjang": "..." },
  "message": { "text": "...", "isNew": true },
  "months": [
    { "code": "AGU", "paid": true, "transaction": { "idtrx": 123, "nominal": 500000, "tgl_trx": "..." } }
  ]
}
```
- Error:
  - `401` session invalid
  - `503` fetch gagal

### 19.3 `POST /api/push/register-device`
- Request:
```json
{
  "nis": "231297",
  "onesignal_subscription_id": "sub_xxx",
  "platform": "ios_web",
  "external_id": "231297"
}
```
- Action:
  - upsert ke `user_devices_web`
  - attach user ke OneSignal `external_id`

### 19.4 `POST /api/messages/mark-read`
- Request:
```json
{ "nis": "231297", "last_read_message_hash": "..." }
```
- Action:
  - simpan metadata baca (tabel tambahan atau kolom users sesuai implementasi final)

### 19.5 `POST /api/auth/logout`
- Action:
  - clear session cookie
  - optional set `user_devices_web.is_active = false` per current web session

## 20. Environment Variables (Vercel)

### 20.1 Client-safe (`NEXT_PUBLIC_*`)
- `NEXT_PUBLIC_APP_NAME=MyKahfi`
- `NEXT_PUBLIC_ONESIGNAL_APP_ID=...`
- `NEXT_PUBLIC_SUPABASE_URL=...` (opsional jika ada kebutuhan client library)

### 20.2 Server-only (wajib rahasia)
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...` (jika dipakai server route non-privileged)
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `ONESIGNAL_REST_API_KEY=...`
- `SESSION_SECRET=...` (random strong secret)
- `APP_ENV=production|staging`

## 21. State & Edge Case Matrix

- Login:
  - invalid credential -> tampilkan "NIS/Password salah".
  - timeout/network -> tampilkan pesan koneksi user-friendly + tombol coba lagi.
- Dashboard:
  - gagal load -> tampilkan card error + retry.
  - data parsial -> tampilkan data terakhir + indikator refresh gagal.
- Push:
  - user menolak izin notif -> tampilkan banner edukasi enable notification.
  - subscription id hilang/rotasi -> auto re-register via `/api/push/register-device`.
  - iOS lama (<16.4) -> tampilkan fallback tanpa push.
- Session:
  - expired -> redirect ke login + pesan sesi berakhir.

## 22. Push Flow OneSignal (Detail)

### 22.1 Sumber Event
- Event `payment` dari Supabase edge function/trigger existing.
- Event `message` dari pipeline `notify-message`.

### 22.2 Routing Target
- Target by `external_id = nis`.
- Filter hanya device aktif (`user_devices_web.is_active = true`) pada layer internal log/validation.

### 22.3 Payload Standar
- Title:
  - payment: `Pembayaran Berhasil`
  - message: `Pesan Sekolah`
- Body:
  - ringkas, tanpa data sensitif.
- Data:
  - `event_type`, `nis`, `deeplink=/dashboard`.

### 22.4 Retry & Idempotency
- Simpan event ke `notification_logs` status `queued`.
- Saat kirim sukses -> `sent` + simpan `provider_message_id`.
- Gagal -> `failed` + `error_message`.
- Gunakan `event_id` unik internal untuk cegah kirim ganda.

## 23. Definition of Done (DoD) per Milestone

### Milestone 1 DoD
- Login web berfungsi end-to-end.
- Session aman (httpOnly cookie).
- Error handling user-friendly.

### Milestone 2 DoD
- Dashboard parity visual/fungsi minimal dengan Android.
- Detail transaksi dan pesan sekolah berjalan stabil.

### Milestone 3 DoD
- OneSignal web push aktif iOS PWA + Android Chrome.
- Registrasi device tersimpan di `user_devices_web`.
- `notification_logs` mencatat outcome kirim.

### Milestone 4 DoD
- UAT lulus.
- Monitoring aktif.
- Tidak ada blocker security high severity.

## 24. Test Plan Minimum

### 24.1 Functional
- Login sukses/gagal.
- Dashboard load + retry.
- Detail transaksi tiap status bulan.
- Pesan sekolah + link.
- Logout + relogin.

### 24.2 Push
- iPhone (PWA installed) menerima push payment & message.
- Android Chrome (tanpa install app Play Store) menerima web push.
- User revoke permission -> sistem fallback gracefully.

### 24.3 Device/Browser Matrix
- iOS Safari (16.4+), iOS PWA.
- Android Chrome (latest 2 major versions).
- Desktop Chrome/Safari (sanity check).

## 25. Rollout Plan

1. Staging internal (tim sekolah).
2. Pilot terbatas (10-20 wali murid campuran iPhone + Android web).
3. Production gradual:
   - 25% user
   - 50% user
   - 100% user
4. Observasi 72 jam pertama:
   - login error rate
   - dashboard error rate
   - push delivery rate
   - komplain pengguna.

## 26. Fleksibilitas Android Non-PlayStore

Project web Vercel harus mendukung user Android yang tidak memasang aplikasi resmi dari Play Store:

- User Android dapat login via browser (Chrome) ke web MyKahfi.
- User dapat mengaktifkan web push OneSignal dari browser/PWA.
- Notifikasi payment/message dikirim ke kanal web ini dengan identity user yang sama (`external_id = nis`).
- UX dan isi notifikasi dijaga konsisten dengan aplikasi Android native, agar pengalaman pengguna tetap seragam lintas kanal.

Implikasi teknis:
- `platform` pada `user_devices_web` wajib mendukung `android_web`.
- Event notifikasi dikirim ke semua device aktif user (native + web) sesuai strategi deduplikasi yang disepakati.

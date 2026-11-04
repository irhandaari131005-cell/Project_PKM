# Halaman login

## Lokasi editing

| Yang ingin diubah | Lokasi |
| --- | --- |
| Seluruh tampilan login | `src/pages/LoginPage/Login.jsx` |
| Judul, nama sekolah, lokasi logo dan latar | Konstanta `LOGIN_CONTENT` di bagian atas `Login.jsx` |
| Tinggi banner, overlay, ukuran logo, judul sistem | Bagian komentar `EDIT BANNER` di `Login.jsx` |
| Kartu putih dan judul Selamat Datang | Bagian komentar `EDIT PANEL` di `Login.jsx` |
| Jarak, warna, ukuran field dan tombol | Bagian komentar `EDIT FORM` di `Login.jsx` |
| Pilihan jenis akun login dan registrasi | `LOGIN_ROLES` dan `REGISTER_ROLES` di `src/services/auth.js` |
| Nama field request | `LOGIN_FIELDS` dan `buildLoginPayload` di `src/services/auth.js` |
| Link REGISTER dan form pendaftaran | `src/pages/LoginPage/Login.jsx`, bagian paragraf setelah tombol submit |
| Request registrasi | `REGISTER_FIELDS`, `buildRegisterPayload`, dan `authApi.register` di `src/services/auth.js` |
| Pembacaan respons backend | `normalizeLoginResponse` di `src/services/auth.js` |
| Pemeriksaan sesi dan perpindahan login/dashboard | `src/services/auth.js`, `src/App.jsx`, dan `src/routes.js` |
| URL backend | `.env.local`, contoh tersedia di `.env.example` |
| Logo | `public/logodhakar.png` |
| Latar banner | `public/login-school.png` |

Rute frontend adalah `/login`, `/register`, dan `/dashboard`. URL `/` mengarahkan pengguna berdasarkan sesi yang telah divalidasi backend. Tautan lama `?page=login` dan `?page=register` tetap diterima dan diubah menjadi path canonical. Saat aplikasi dibuka atau di-refresh, `GET /api/me` memeriksa sesi sebelum dashboard ditampilkan. Pada `/` dan `/dashboard`, HTTP 401 mengarahkan ke `/login`; kegagalan jaringan atau server menampilkan pesan dan tombol coba lagi. Form `/login` dan `/register` tetap dapat dibuka saat pemeriksaan sesi berjalan atau backend tidak tersedia. Sesi valid mengarahkan pengguna dari kedua form tersebut ke `/dashboard`. Alur ini berlaku pada development dan hasil build, tanpa bypass autentikasi. Tombol keluar memanggil `GET /api/logout` untuk mengakhiri sesi backend sebelum kembali ke `/login`.

## Endpoint login dan sesi

Backend menggunakan sesi cookie CodeIgniter. Frontend menerima respons login dengan profil pengguna langsung pada `data` dan path tujuan pada `redirect`.

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_LOGIN_ENDPOINT=/api/login
VITE_SESSION_ENDPOINT=/api/me
VITE_LOGOUT_ENDPOINT=/api/logout
```

Restart Vite setelah mengubah `.env.local`. Form mengirim `POST` JSON melalui Axios instance yang sama dengan dashboard, dengan `withCredentials: true` agar browser menerima dan mengirim cookie sesi. Request login tidak menyertakan Bearer token sesi sebelumnya. Gunakan hostname yang sama untuk frontend dan backend, misalnya `http://localhost:5173` dan `http://localhost:8080`; jangan mencampur `localhost` dengan `127.0.0.1`.

```json
{
  "username": "contoh_guru",
  "password": "password_dari_form",
  "type": "guru"
}
```

Pilihan login tetap `guru`, `siswa`, dan `wali_murid`. Pilihan registrasi dibatasi ke `guru` dan `siswa` sesuai validasi backend CodeIgniter; `wali_murid` tidak dikirim ke endpoint registrasi. Username dipangkas spasi di tepinya; isi password dikirim utuh. Nama field dapat diubah lewat `LOGIN_FIELDS` tanpa mengubah UI.

Respons login berhasil:

```json
{
  "status": 200,
  "message": "Login berhasil",
  "redirect": "/dashboard",
  "data": {
    "id_user": 1,
    "username": "contoh_guru",
    "nama": "Budi Santoso, S.Pd.",
    "type": "guru"
  }
}
```

Setelah respons valid, frontend berpindah ke `/dashboard`. Backend menyimpan sesi melalui cookie `HttpOnly` dengan `SameSite=Lax`; JavaScript tidak perlu membaca cookie tersebut. `GET /api/me` mengembalikan pengguna dari sesi backend dan menjadi pemeriksaan autentikasi saat aplikasi dimuat atau halaman dashboard di-refresh. Cache profil lokal tidak memberikan akses dashboard dengan sendirinya.

Objek profil dapat disimpan sebagai `auth_user`; password tidak disimpan. Frontend tidak membuat token atau penanda sesi palsu untuk respons cookie. Kompatibilitas API Bearer tetap didukung untuk respons yang benar-benar mengirim `token` atau `access_token`, termasuk bentuk `{ token, user }` atau pembungkus `data`; token asli disimpan sebagai `auth_token` dan dikirim sebagai `Authorization: Bearer ...`. Backend tetap menentukan autentikasi dan hak akses pengguna; pilihan jenis akun pada form dikirim untuk diverifikasi backend.

`GET /api/logout` mengakhiri sesi backend sebelum frontend membersihkan cache sesi dan mengarahkan pengguna ke `/login`. Backend perlu mengizinkan origin frontend secara eksplisit melalui CORS dan mengaktifkan credentials. Pada hosting produksi, semua path frontend harus memiliki fallback ke `index.html` untuk akses langsung dan refresh, sedangkan endpoint API tetap dilayani backend.

Respons validasi HTTP 422:

```json
{
  "message": "Data login belum valid",
  "errors": {
    "username": ["Username wajib diisi."],
    "password": ["Password wajib diisi."],
    "type": ["Jenis akun tidak tersedia."]
  }
}
```

Error tersebut ditampilkan di field terkait. HTTP 400/401/403 saat login menampilkan pesan kredensial tidak sesuai. Timeout dan koneksi gagal ditampilkan tanpa membuka dashboard.

## Registrasi akun

Paragraf **Belum punya akun? REGISTER** berada tepat di bawah tombol LOGIN. Link membuka form pendaftaran dengan nama lengkap, username, SN, jenis akun, password, dan konfirmasi password. Di form registrasi, **Sudah punya akun? LOG IN** kembali ke login.

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_REGISTER_ENDPOINT=/api/register
```

`authApi.register(values, { signal })` mengirim `POST` JSON melalui Axios tanpa Bearer token sesi lama. Endpoint dapat diubah lewat `.env.local`; restart Vite setelah mengubahnya. Nama field request dan pemetaan validasi Laravel dapat diubah di `REGISTER_FIELDS`.

Kontrak request default yang disepakati:

```json
{
  "nama": "Budi Santoso",
  "username": "contoh_guru",
  "sn": "000123",
  "type": "guru",
  "password": "password123",
  "password_confirmation": "password123"
}
```

Nama, username, dan SN wajib diisi sebagai string, dengan spasi tepi dipangkas. SN dikirim sebagai string agar nol di depan tetap utuh. `REGISTER_ROLES` hanya menyediakan `guru` dan `siswa`, sesuai aturan `in_list[siswa,guru]` pada backend. Password minimal 8 karakter dan konfirmasi harus sama; spasi pada password dipertahankan. Backend tetap memvalidasi field, keunikan username, dan jenis akun yang boleh dibuat. ID pengguna dibuat oleh backend/database, bukan dikirim oleh form registrasi.

Respons berhasil: HTTP **201** (HTTP 200 juga didukung) dengan objek JSON, contoh:

```json
{
  "status": 201,
  "message": "Registrasi berhasil",
  "redirect": "/login"
}
```

Objek `{ "message": "Registrasi berhasil" }` juga didukung. Token tidak diperlukan untuk respons registrasi. Setelah sukses, form kembali ke `/login`, menampilkan pesan berhasil, mempertahankan username/jenis akun, dan mengosongkan password. Tidak ada sesi yang dibuat otomatis oleh registrasi.

Respons validasi CodeIgniter: HTTP **422**, dengan nama field yang sama seperti request:

```json
{
  "message": "Data pendaftaran belum valid",
  "errors": {
    "nama": "Nama wajib diisi.",
    "username": "Username sudah digunakan.",
    "sn": "SN wajib diisi.",
    "type": "Jenis akun tidak tersedia.",
    "password": "Password minimal 8 karakter.",
    "password_confirmation": "Konfirmasi password tidak cocok."
  }
}
```

Validasi tampil pada field terkait. HTTP **409** ditangani sebagai konflik username, **401/403** sebagai pendaftaran yang tidak diizinkan, dan **429** sebagai terlalu banyak percobaan. Koneksi gagal dan timeout tetap menampilkan form agar dapat dicoba kembali. Pembungkus JSON dengan `status` 400–599, `status: false`, atau `success: false` ditolak meskipun HTTP mengembalikan 200. Request dapat dibatalkan saat halaman ditutup.

Proyek ini menyediakan frontend pemanggil API; kode backend dikelola dalam repository terpisah. Backend perlu menyediakan route `POST /api/register`, menyimpan akun, mengembalikan respons sesuai kontrak di atas, serta mengizinkan origin frontend melalui CORS.

Jika backend mengembalikan HTTP **500**, form menampilkan pesan kegagalan server dan tetap menyimpan input agar dapat dicoba lagi. Contoh masalah yang perlu diperiksa di backend adalah log `Duplicate entry '' for key 'users.PRIMARY'`: pembuatan primary key saat menyimpan pengguna gagal. Model backend mengasumsikan ID otomatis; periksa skema primary key dan pembuatannya sebelum mengubah database. Tes frontend memakai server HTTP simulasi, sehingga kelulusan tes tidak membuktikan penyimpanan ke database backend asli.

## Aset banner

Logo berasal dari aset proyek yang sudah tersedia. `public/login-school.png` adalah ilustrasi foto lingkungan sekolah yang dibuat menggunakan built-in imagegen, bukan foto asli SMK Dharma Karya. Ganti file atau nilai `LOGIN_CONTENT.background` untuk menggunakan foto sekolah sebenarnya.

Prompt final yang digunakan:

> Use case: photorealistic-natural. Asset type: background photograph for a narrow mobile school login header, landscape 3:2 composition. Create a natural daytime editorial photograph of a modest Indonesian secondary-school courtyard, seen from an elevated first-floor corridor, with two- to three-storey off-white and pale aqua classroom buildings flanking a central courtyard, simple railings, tropical daylight and a flagpole. A few very small indistinct uniformed students in the courtyard are fine, no identifiable faces. Composition should show architecture on the left and right and an open middle distance. Natural real-world textures, slightly documentary quality. No text, no lettering, no logos, no watermarks, no UI, no decorative frames. The image will be cropped wide and given a dark teal overlay in CSS. This is an illustrative setting, not an actual named school. Save a project-usable raster file and return its local image path.

# Dashboard Page — React + Tailwind CSS

Halaman login mengikuti referensi dan berada di `src/pages/LoginPage/Login.jsx`. Panduan lokasi editing, aset, payload, serta kontrak endpoint login ada di [docs/login-page.md](docs/login-page.md). Rute frontend tersedia di `/login`, `/register`, dan `/dashboard`. Setelah login berhasil, pengguna diarahkan ke `/dashboard`; saat aplikasi dibuka atau di-refresh, sesi divalidasi melalui backend sebelum dashboard ditampilkan.

Komponen bersama dashboard berada di `src/pages/DashboardPage/Dashbord.jsx`, yang digunakan oleh `src/App.jsx`. Bottom Navigation, ganti password, header, profil, sidebar, kartu statistik, dan welcome card menjadi fungsi internal di file tersebut. Halaman Absensi, Riwayat Absensi, Data Siswa, Data Guru, dan Data Kelas berada di folder halaman masing-masing dan memakai navigasi dashboard yang sama.

```text
src/pages/DashboardPage/
  Dashbord.jsx           # Seluruh tampilan dan navigasi dashboard
  dashboardData.js       # Payload asli, pemetaan tampilan, dan statistik
  useDashboardData.js    # Loading, error, retry, dan pembatalan request
src/routes.js            # Helper rute URL dan kompatibilitas tautan ?page=
src/App.jsx              # Perpindahan halaman dan pemeriksaan sesi
src/services/api.js      # Axios instance, cookie sesi, dan kompatibilitas Bearer
src/services/apiContracts.js # Nama field backend dan helper payload kirim
src/pages/LoginPage/Login.jsx # Tampilan login dalam satu file
src/pages/AttendancePage/Attendance.jsx # Halaman TAP kartu, masuk/pulang, jam, dan form SN
src/services/attendance.js # POST presensi, payload, respons, dan error API
src/pages/AttendanceHistoryPage/AttendanceHistory.jsx # Riwayat, filter kelas/tanggal, dan pagination
src/services/attendanceHistory.js # GET daftar kelas dan riwayat melalui Axios
src/pages/StudentsPage/Students.jsx # Kartu siswa, pencarian, ringkasan, dan modal tambah
src/services/students.js # GET pencarian siswa dan POST tambah siswa melalui Axios
src/pages/TeachersPage/Teachers.jsx # Kartu guru, pencarian nama/NIP, dan modal tambah
src/services/teachers.js # GET pencarian guru dan POST tambah guru melalui Axios
src/pages/ClassesPage/Classes.jsx # Kartu kelas, pencarian, modal tambah/detail/edit
src/services/classes.js # GET/POST kelas dan GET/PUT detail kelas melalui Axios
src/services/auth.js      # Request login, pemetaan respons, dan sesi
docs/api-contracts.md     # Kontrak yang diketahui dan contoh penggunaan
docs/login-page.md        # Panduan editing dan integrasi login
```

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Saat menjalankan `npm run dev`, buka alamat yang ditampilkan Vite. URL `/` mengarahkan pengguna ke `/dashboard` bila sesi backend valid, atau `/login` bila belum login. Link **REGISTER** membuka `/register`. Tautan lama `?page=login` dan `?page=register` tetap didukung dan diubah ke path yang sesuai. Alur autentikasi sama pada development dan hasil build; tidak ada bypass login untuk preview dashboard.

Salin `.env.example` ke `.env.local` jika file konfigurasi belum ada. Atur alamat backend dan path endpoint sesuai route backend:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_DATA_SISWA_ENDPOINT=/api/data_siswa
VITE_DATA_GURU_ENDPOINT=/api/data_guru
VITE_LOGIN_ENDPOINT=/api/login
VITE_REGISTER_ENDPOINT=/api/register
VITE_SESSION_ENDPOINT=/api/me
VITE_LOGOUT_ENDPOINT=/api/logout
VITE_ATTENDANCE_ENDPOINT=/api/absensi
VITE_CLASSES_ENDPOINT=/api/kelas
VITE_ATTENDANCE_HISTORY_ENDPOINT=/api/absensi/riwayat
```

Jika route backend tidak memakai prefix `/api`, gunakan `/data_siswa` dan `/data_guru`. Restart Vite setelah mengubah konfigurasi. Gunakan hostname yang sama untuk frontend dan backend, misalnya `localhost` pada keduanya; jangan mencampur `localhost` dengan `127.0.0.1` untuk sesi cookie. Konfigurasi lama `VITE_DASHBOARD_ENDPOINT` tidak digunakan lagi.

Registrasi mengirim `POST /api/register` dengan `nama`, `username`, `sn`, `type`, `password`, dan `password_confirmation`, lalu kembali ke login setelah berhasil. SN wajib diisi dan dikirim sebagai string agar nol di depan tetap utuh. Kontrak request, respons, dan validasi untuk backend ada di [docs/login-page.md](docs/login-page.md#registrasi-akun).

Sidebar **Absensi** dan tombol **Scan Presensi** membuka halaman yang sama. Pilih masuk/pulang, tekan area scan, lalu baca nomor kartu dengan reader keyboard atau ketik SN dan tekan Enter/tombol centang. Axios mengirim `POST /api/absensi` dengan `sn` dan `jenis_absensi` memakai sesi backend. Kontrak endpoint dan respons backend ada di [docs/attendance-page.md](docs/attendance-page.md).

Sidebar **Riwayat Absensi** membuka daftar nama dan status kehadiran dengan filter kelas/tanggal. Axios mengambil pilihan kelas dari `GET /api/kelas` dan riwayat dari `GET /api/absensi/riwayat` dengan query `id_kelas`, `tanggal`, dan `page`. Kontrak respons, pagination, serta konfigurasi backend ada di [docs/attendance-history-page.md](docs/attendance-history-page.md).

Frontend memanggil kedua endpoint saat Dashboard Page dibuka. Menu **Data Siswa** memiliki halaman kartu, pencarian nama/NIS di server, ringkasan jumlah siswa/kelas, pagination, dan form **+ Data Siswa** melalui GET/POST `/api/data_siswa`; kontraknya ada di [docs/students-page.md](docs/students-page.md). Menu **Data Guru** menyediakan kartu nama/NIP, status, mata pelajaran, pencarian, pagination, serta form **+ Data Guru** melalui GET/POST `/api/data_guru`; kontraknya ada di [docs/teachers-page.md](docs/teachers-page.md). Kegagalan satu endpoint tidak menghalangi endpoint lainnya. Masing-masing menyediakan loading, pesan error, dan tombol coba lagi. Jumlah yang belum tersedia ditampilkan sebagai `—`; respons kosong yang valid menghasilkan `0`.

Menu **Data Kelas** menyediakan pencarian nama kelas, kartu jumlah siswa/wali kelas, pagination, serta form tambah, detail, dan edit. Axios memakai GET/POST `/api/kelas`, GET/PUT `/api/kelas/{id_kelas}`, dan GET `/api/data_guru` untuk pilihan wali kelas. Payload simpan berisi `nama_kelas` dan `id_wali_kelas`. Kontrak lengkap dan kebutuhan backend ada di [docs/classes-page.md](docs/classes-page.md).

## Menggunakan Axios

Axios sudah termasuk dependency proyek. `src/services/api.js` membuat `apiClient` dengan `baseURL` dari konfigurasi, `withCredentials: true` untuk cookie sesi, header `Accept: application/json`, dan timeout 15 detik. Endpoint siswa/guru dipanggil dengan `params: { page }` dan `signal` dari `AbortController`.

Alur datanya: `Dashbord.jsx` → `useDashboardData.js` → `dashboardApi` → backend. Hook menyimpan seluruh JSON dari `response.data` di `students.payload`/`teachers.payload`. `items` berisi record dengan semua nama field asli backend, termasuk `status`, `type`, `created_date`, `update_date`, dan field tambahan. `getPersonView` memetakan nama tampilan saat render; statistik membaca jumlah koleksi.

Contoh pemanggilan endpoint yang sama dari bagian aplikasi lain:

```js
import { dashboardApi } from "./services/api.js";

const payload = await dashboardApi.getStudents({ page: 1 });
```

Untuk endpoint tambahan, gunakan Axios instance yang sama:

```js
import { apiClient } from "./services/api.js";

const response = await apiClient.get("/api/data_guru", {
  params: { page: 1 },
});
const payload = response.data;
```

Sesuaikan path import dengan lokasi file pemanggil. Konfigurasi instance dan `params` mengikuti [dokumentasi resmi Axios](https://axios.rest/pages/advanced/request-config).

## Kontrak endpoint

Keduanya menggunakan GET. Parameter `?page=1` dikirim untuk mendukung pagination Laravel.

Contoh `GET /api/data_siswa?page=1`:

```json
{
  "status": 200,
  "message": "Data berhasil diambil",
  "data": [
    {
      "id_siswa": "1",
      "nama_siswa": "Andi Pratama",
      "status": "ACTIVE",
      "created_date": "2026-10-13 21:25:09",
      "update_date": "Admin",
      "sn": "1051234561",
      "type": "siswa"
    }
  ]
}
```

Contoh daftar guru di dalam `data` (atau sebagai array langsung):

```json
[
  {
    "id_guru": "1",
    "nama": "Budi Santoso, S.Pd.",
    "type": "guru",
    "created_date": "2026-10-13 21:22:54",
    "sn": "1985010110",
    "update_date": null
  }
]
```

Respons juga dapat berupa array langsung, `{ "data": [...] }`, `{ "data_siswa": [...] }`, `{ "data_guru": [...] }`, atau paginator yang dibungkus `{ "data": { ... } }`. Daftar tanpa pagination dihitung dari panjang array. Jika memakai pagination, kirim `total` untuk jumlah seluruh data dan `current_page`/`last_page` untuk navigasi halaman. Tanpa `total`, panjang satu halaman tidak digunakan sebagai jumlah keseluruhan.

`status: 200` pada pembungkus respons menandakan pengambilan berhasil. Status error numerik 400–599 pada pembungkus ditangani sebagai kegagalan, termasuk jika HTTP mengembalikan 200. Field `status: "ACTIVE"` di dalam record siswa merupakan data siswa dan tidak memengaruhi status request. ID dan `sn` tetap dipertahankan sebagai string jika backend mengirim string, sehingga nol di depan nomor identitas tidak hilang.

Nama field utama dipusatkan di `src/services/apiContracts.js`. Pemetaan tampilan berada di `dashboardData.js`:

| Informasi | Field yang didukung |
| --- | --- |
| ID siswa | `id_siswa`, lalu `id` |
| ID guru | `id_guru`, lalu `id` |
| Nama siswa | `nama_siswa`, lalu `nama`, `nama_guru`, `name` |
| Nama guru | `nama`, lalu `nama_guru`, `name` |
| Identitas siswa | `sn`, lalu `nisn`, `nis` |
| Identitas guru | `sn`, lalu `nig`, `nip` |
| Status record | `status` jika diberikan |
| Tipe record | `type` jika diberikan |
| Data audit | `created_date`, `update_date` dipertahankan tanpa konversi |
| Kelas | `kelas` (teks atau objek dengan `nama_kelas`/`nama`), `nama_kelas` |
| Mapel / jabatan | `mata_pelajaran`, `mapel` (teks atau objek dengan `nama_mapel`/`nama`), `jabatan` |

Daftar menggunakan label “Nomor Identitas”, status, dan tipe sesuai contoh API. Nilai yang tidak diberikan ditampilkan sebagai `-`. Kelas/mapel dan field tambahan tetap tersedia di record asli. `created_date` dan `update_date` tidak digunakan untuk statistik; `update_date` dapat berisi `"Admin"` atau `null` sesuai contoh, sehingga tidak diubah menjadi tanggal.

## Menyiapkan payload pengiriman

Gunakan `buildResourcePayload(resource, values, writableFields)` setelah daftar field request dikonfirmasi dari validasi backend. Helper memilih field dengan nama asli API dan mempertahankan tipe nilainya; field lain tidak ikut dikirim. Daftar field yang boleh ditulis wajib diberikan, dan tidak ada request tambah/ubah yang dijalankan otomatis.

Kontrak lengkap dan contoh pemakaian ada di [docs/api-contracts.md](docs/api-contracts.md). Field pada contoh respons digunakan sebagai acuan kontrak frontend. Penyamaan dengan database perlu mengacu pada migration/schema dan validator backend, yang belum ada dalam proyek ini.

Statistik kehadiran dan ekstrakurikuler menampilkan `—` sampai sumber datanya tersedia.

## Autentikasi dan integrasi aplikasi

Backend lokal menggunakan sesi cookie CodeIgniter. Login mengirim `POST /api/login`; respons berhasil berisi `status: 200`, `redirect: "/dashboard"`, dan profil pengguna pada `data`. Browser menyimpan cookie `HttpOnly` dengan `SameSite=Lax`, lalu Axios menyertakannya melalui `withCredentials: true`. Frontend tidak membuat token atau penanda sesi palsu. Cache profil lokal tidak menjadi bukti login. Kompatibilitas Bearer tetap tersedia: bila backend mengirim token asli, interceptor membaca `auth_token` dan menambahkan `Authorization: Bearer ...`. Jangan menyimpan token login dalam variabel `VITE_*`.

`src/App.jsx` mengelola rute `/login`, `/register`, dan `/dashboard`, dengan helper URL di `src/routes.js`. Saat aplikasi dimuat atau `/dashboard` di-refresh, `GET /api/me` memvalidasi sesi. Pada `/` dan `/dashboard`, HTTP 401 mengarahkan ke `/login`, sedangkan koneksi gagal atau error server menampilkan pesan dan tombol coba lagi. Form `/login` dan `/register` tetap dapat dibuka saat pemeriksaan sesi berjalan atau backend tidak tersedia. Pengguna dengan sesi valid yang membuka `/` atau halaman login/registrasi diarahkan ke `/dashboard`. Tombol **Keluar** memanggil `GET /api/logout` untuk mengakhiri sesi backend sebelum kembali ke `/login`.

Backend perlu mengizinkan origin frontend secara eksplisit melalui CORS, mengaktifkan credentials, serta mengizinkan header `Accept` dan `Authorization` bila dipakai. Untuk deployment, hosting frontend harus meneruskan permintaan path SPA seperti `/login`, `/register`, dan `/dashboard` ke `index.html` agar akses langsung dan refresh bekerja. Endpoint API tetap dilayani backend secara terpisah.

`Dashbord` menerima props opsional `schoolName`, `profile`, `onNavigate`, `onEditProfile`, dan `onLogout`. Data profil berasal dari pengguna yang sedang login, bukan dari baris pertama daftar siswa/guru. `profile` dapat menerima record backend secara langsung atau `{ data: record }`, dengan nama `nama_siswa`/`nama`, identitas `sn`, `status`, dan `type`. Props tampilan lama (`name`, `nisn`/`nig`/`nip`, `birthDate`, `address`, `phone`, `photo`) tetap didukung. Field kontak dan foto belum memiliki kontrak API yang diberikan.

Menu lain meneruskan key melalui `onNavigate(key)` atau event browser `school:navigate` dengan `detail.key`. Edit profil meneruskan `edit-profile`; keluar meneruskan `logout` jika callback khusus belum diberikan. Hubungkan callback tersebut ke alur aplikasi induk. Modal ganti password saat ini memvalidasi input; penyimpanan password memerlukan endpoint terpisah yang belum disediakan.

## Verifikasi

```bash
npm test
npm run build
```

Tes memeriksa normalisasi respons, total pagination, data kosong, dan integrasi Axios melalui server HTTP lokal: autentikasi, parameter halaman, pembatalan, timeout, respons tidak valid, serta kegagalan satu endpoint. Kode backend dikelola dalam repository terpisah.

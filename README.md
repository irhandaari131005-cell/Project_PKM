# Dashboard Page — React + Tailwind CSS

Halaman login mengikuti referensi dan berada di `src/pages/LoginPage/Login.jsx`. Panduan lokasi editing, aset, payload, serta kontrak endpoint login ada di [docs/login-page.md](docs/login-page.md). Saat development, aplikasi langsung membuka preview dashboard. Pada hasil build, aplikasi membuka login jika belum ada token sesi; setelah respons login valid, aplikasi membuka dashboard.

Komponen bersama dashboard berada di `src/pages/DashboardPage/Dashbord.jsx`, yang digunakan oleh `src/App.jsx`. Bottom Navigation, ganti password, header, profil, sidebar, kartu statistik, dan welcome card menjadi fungsi internal di file tersebut. Halaman Absensi, Riwayat Absensi, Data Siswa, Data Guru, Data Kelas, Ekstrakurikuler, dan Jadwal berada di folder halaman masing-masing dan memakai navigasi dashboard yang sama.

```text
src/pages/DashboardPage/
  Dashbord.jsx           # Seluruh tampilan dan navigasi dashboard
  dashboardData.js       # Payload asli, pemetaan tampilan, dan statistik
  useDashboardData.js    # Loading, error, retry, dan pembatalan request
src/services/api.js      # Axios instance, endpoint, dan Bearer token
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
src/pages/ExtracurricularPage/Extracurricular.jsx # Kegiatan, pembina, hari/jam, tambah/detail/edit
src/pages/SchedulesPage/Schedules.jsx # Jadwal pelajaran, filter hari/kelas, tambah/detail/edit
src/services/extracurricular.js # GET/POST/PUT ekstrakurikuler melalui Axios
src/services/schedules.js # GET/POST/PUT jadwal melalui Axios
src/services/auth.js      # Request login, pemetaan respons, dan sesi
docs/api-contracts.md     # Kontrak yang diketahui dan contoh penggunaan
docs/login-page.md        # Panduan editing dan integrasi login
```

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Saat menjalankan `npm run dev`, buka alamat yang ditampilkan Vite untuk melihat dashboard tanpa login. Untuk melihat halaman login saat belum ada sesi, tambahkan `?page=login` pada alamat tersebut (contoh: `http://localhost:5173/?page=login`), atau klik **Keluar** di dashboard. Link **REGISTER** di bawah tombol LOGIN membuka form pendaftaran (`?page=register`). Preview ini tidak membuat token sesi; data dari endpoint yang memerlukan login tetap membutuhkan sesi backend yang valid.

Salin `.env.example` ke `.env.local` jika file konfigurasi belum ada. Atur alamat backend dan path endpoint sesuai route Laravel:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SISWA_ENDPOINT=/api/data_siswa
VITE_DATA_GURU_ENDPOINT=/api/data_guru
VITE_LOGIN_ENDPOINT=/api/login
VITE_REGISTER_ENDPOINT=/api/register
VITE_ATTENDANCE_ENDPOINT=/api/absensi
VITE_CLASSES_ENDPOINT=/api/kelas
VITE_ATTENDANCE_HISTORY_ENDPOINT=/api/absensi/riwayat
VITE_EXTRACURRICULAR_ENDPOINT=/api/ekstrakurikuler
VITE_EXTRACURRICULAR_PHOTOS_ENDPOINT=/api/ekstrakurikuler/foto
VITE_SCHEDULES_ENDPOINT=/api/jadwal
```

Jika route backend tidak memakai prefix `/api`, gunakan `/data_siswa` dan `/data_guru`. Restart Vite setelah mengubah konfigurasi. Konfigurasi lama `VITE_DASHBOARD_ENDPOINT` tidak digunakan lagi.

Registrasi mengirim `POST /api/register` dengan `nama`, `username`, `type`, `password`, dan `password_confirmation`, lalu kembali ke login setelah berhasil. Kontrak request, respons, dan validasi untuk backend ada di [docs/login-page.md](docs/login-page.md#registrasi-akun).

Sidebar **Absensi** dan tombol **Scan Presensi** membuka halaman yang sama. Pilih masuk/pulang, tekan area scan, lalu baca nomor kartu dengan reader keyboard atau ketik SN dan tekan Enter/tombol centang. Axios mengirim `POST /api/absensi` dengan `sn` dan `jenis_absensi` memakai token sesi. Kontrak endpoint dan respons backend ada di [docs/attendance-page.md](docs/attendance-page.md).

Sidebar **Riwayat Absensi** membuka daftar nama dan status kehadiran dengan filter kelas/tanggal. Axios mengambil pilihan kelas dari `GET /api/kelas` dan riwayat dari `GET /api/absensi/riwayat` dengan query `id_kelas`, `tanggal`, dan `page`. Kontrak respons, pagination, serta konfigurasi backend ada di [docs/attendance-history-page.md](docs/attendance-history-page.md).

Frontend memanggil kedua endpoint saat Dashboard Page dibuka. Menu **Data Siswa** memiliki halaman kartu, pencarian nama/NIS di server, ringkasan jumlah siswa/kelas, pagination, dan form **+ Data Siswa** melalui GET/POST `/api/data_siswa`; kontraknya ada di [docs/students-page.md](docs/students-page.md). Menu **Data Guru** menyediakan kartu nama/NIP, status, mata pelajaran, pencarian, pagination, serta form **+ Data Guru** melalui GET/POST `/api/data_guru`; kontraknya ada di [docs/teachers-page.md](docs/teachers-page.md). Kegagalan satu endpoint tidak menghalangi endpoint lainnya. Masing-masing menyediakan loading, pesan error, dan tombol coba lagi. Jumlah yang belum tersedia ditampilkan sebagai `—`; respons kosong yang valid menghasilkan `0`.

Menu **Data Kelas** menyediakan pencarian nama kelas, kartu jumlah siswa/wali kelas, pagination, serta form tambah, detail, dan edit. Axios memakai GET/POST `/api/kelas`, GET/PUT `/api/kelas/{id_kelas}`, dan GET `/api/data_guru` untuk pilihan wali kelas. Payload simpan berisi `nama_kelas` dan `id_wali_kelas`. Kontrak lengkap dan kebutuhan backend ada di [docs/classes-page.md](docs/classes-page.md).

Menu **Ekstrakurikuler** dan **Jadwal** menyediakan daftar, pencarian, filter hari, pagination, serta form tambah/detail/edit. Jadwal pelajaran juga dapat difilter berdasarkan kelas. Endpoint default memakai GET/POST `/api/ekstrakurikuler` dan `/api/jadwal`, serta GET/PUT `/{id}` pada masing-masing resource. Pilihan guru/kelas diambil dari API yang sudah ada. Kontrak payload, respons, validasi waktu WIB, dan kebutuhan backend ada di [docs/school-activities-api.md](docs/school-activities-api.md).

Ekstrakurikuler menampilkan carousel di bawah judul, sebelum filter. Form tambah/edit mendukung preview dan upload maksimal 5 foto WebP/JPG/JPEG, saran 1200 × 600 piksel dan 150–300 KB, batas 2 MB/file. Galeri memakai GET `/api/ekstrakurikuler/foto`; unggahan memakai multipart `foto[]`, dan edit foto memakai POST dengan `_method=PUT`. Kontrak penyimpanan/URL foto dan contoh respons ada di [panduan foto ekstrakurikuler](docs/school-activities-api.md#foto-kegiatan-dan-carousel).

## Menggunakan Axios

Axios sudah termasuk dependency proyek. `src/services/api.js` membuat `apiClient` dengan `baseURL` dari konfigurasi, header `Accept: application/json`, dan timeout 15 detik. Endpoint siswa/guru dipanggil dengan `params: { page }` dan `signal` dari `AbortController`.

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

Jika backend memakai Bearer token, interceptor Axios membaca `auth_token` dari `localStorage` pada setiap request. Simpan token dari respons login pada aplikasi:

```js
localStorage.setItem("auth_token", tokenDariResponsLogin);
```

Interceptor akan menambahkan `Authorization: Bearer ...`. Jangan menyimpan token login dalam variabel `VITE_*`. Backend perlu mengizinkan origin frontend melalui CORS, termasuk header `Authorization` dan `Accept`. Respons HTTP 401 dan 403 menghasilkan pesan sesi/akses yang sesuai. Jika backend memakai autentikasi cookie Laravel Sanctum, konfigurasi cookie/CSRF harus disesuaikan dengan alur login backend; konfigurasi saat ini menggunakan Bearer token.

Tampilan dashboard, profil, daftar siswa, daftar guru, sidebar, dan modal password dikelola dalam Dashboard Page. Modul ini belum menambahkan router URL. Saat development, halaman awal menampilkan preview dashboard dan `?page=login` membuka login jika belum ada sesi. Pada hasil build, halaman awal tanpa sesi menampilkan login; token sesi yang tersedia menampilkan Dashboard Page.

`Dashbord` menerima props opsional `schoolName`, `profile`, `onNavigate`, `onEditProfile`, dan `onLogout`. Data profil berasal dari pengguna yang sedang login, bukan dari baris pertama daftar siswa/guru. `profile` dapat menerima record backend secara langsung atau `{ data: record }`, dengan nama `nama_siswa`/`nama`, identitas `sn`, `status`, dan `type`. Props tampilan lama (`name`, `nisn`/`nig`/`nip`, `birthDate`, `address`, `phone`, `photo`) tetap didukung. Field kontak dan foto belum memiliki kontrak API yang diberikan.

Menu lain meneruskan key melalui `onNavigate(key)` atau event browser `school:navigate` dengan `detail.key`. Edit profil meneruskan `edit-profile`; keluar meneruskan `logout` jika callback khusus belum diberikan. Hubungkan callback tersebut ke alur aplikasi induk. Modal ganti password saat ini memvalidasi input; penyimpanan password memerlukan endpoint terpisah yang belum disediakan.

## Verifikasi

```bash
npm test
npm run build
```

Tes memeriksa normalisasi respons, total pagination, data kosong, dan integrasi Axios melalui server HTTP lokal: autentikasi, parameter halaman, pembatalan, timeout, respons tidak valid, serta kegagalan satu endpoint. Backend Laravel tidak termasuk dalam repository ini.

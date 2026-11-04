# Kontrak payload frontend

Kontrak ini mengacu pada contoh respons `data_siswa` dan `data_guru` yang diberikan. Repository ini berisi frontend; schema database, controller, dan validator backend belum tersedia. Kontrak yang sudah diketahui dipusatkan di `src/services/apiContracts.js`.

## Record siswa

| Field API      | Bentuk pada contoh                                           |
| -------------- | ------------------------------------------------------------ |
| `id_siswa`     | String, contoh `"1"`                                         |
| `nama_siswa`   | String                                                       |
| `status`       | String, contoh `"ACTIVE"`; daftar nilai lain belum diberikan |
| `created_date` | String, contoh `"2026-10-13 21:25:09"`                       |
| `update_date`  | String, contoh `"Admin"`                                     |
| `sn`           | String nomor identitas, dipertahankan termasuk nol di depan  |
| `type`         | String, contoh `"siswa"`                                     |

## Record guru

| Field API      | Bentuk pada contoh                     |
| -------------- | -------------------------------------- |
| `id_guru`      | String, contoh `"1"`                   |
| `nama`         | String                                 |
| `type`         | String, contoh `"guru"`                |
| `created_date` | String, contoh `"2026-10-13 21:22:54"` |
| `sn`           | String nomor identitas                 |
| `update_date`  | `null` pada contoh                     |

Field yang belum dikirim tidak diisi dengan nilai buatan. Field tambahan dari backend tetap dipertahankan. Tidak ada validasi enum, panjang field, atau tipe kolom database yang diasumsikan dari satu contoh.

## Respons daftar

Contoh pembungkus siswa:

```json
{
  "status": 200,
  "message": "Data berhasil diambil",
  "data": []
}
```

Contoh guru yang tersedia merupakan potongan record. Frontend mendukung daftar berupa array langsung atau pembungkus `data`, termasuk paginator Laravel. Jumlah berasal dari `total` jika tersedia, atau panjang array untuk daftar tanpa pagination. `status` pada pembungkus merupakan status respons, sedangkan `status` di dalam record merupakan data record.

Hasil `normalizeCollection`:

```js
{
  payload,      // JSON lengkap, termasuk status, message, meta, dan field lain
  items,        // Array record asli dengan nama field API
  total,
  currentPage,
  lastPage,
}
```

Hook menyediakan data ini sebagai `students` dan `teachers`. Pemetaan `getPersonView` digunakan saat render tanpa mengubah payload asli. Data audit dipertahankan sesuai nilainya; `update_date` tidak diparse sebagai tanggal.

## Persiapan payload request

Field request yang boleh ditulis harus mengacu pada controller/validator endpoint tujuan. Sebagai contoh penggunaan helper, jika validator nantinya menerima `nama_siswa` dan `sn`:

```js
import { buildResourcePayload } from "../src/services/apiContracts.js";

const writableFields = ["nama_siswa", "sn"];
const payload = buildResourcePayload(
  "data_siswa",
  {
    id_siswa: "1",
    nama_siswa: "Andi Pratama",
    sn: "001051234561",
    created_date: "2026-10-13 21:25:09",
    update_date: "Admin",
  },
  writableFields,
);

// { nama_siswa: "Andi Pratama", sn: "001051234561" }
```

Untuk guru, gunakan resource `data_guru` serta field `nama`/field lain yang diterima validator. Sesuaikan path import dengan lokasi kode pemanggil.

Helper mengabaikan field yang tidak dipilih atau bernilai `undefined`, mempertahankan `null` yang dipilih, dan menolak nama field yang belum dikenal. Tidak ada konversi angka/tanggal, penambahan nilai default, atau request jaringan. Nilai request tetap harus divalidasi backend.

Halaman Data Siswa menyiapkan kontrak frontend tambahan untuk `nis` dan `id_kelas`, GET pencarian, serta POST tambah siswa. Field dan validasi request-nya dipusatkan di `STUDENT_FIELDS`/`buildStudentPayload` pada `src/services/students.js`; contoh respons dan kebutuhan backend ada di [students-page.md](students-page.md). `nis` dan `sn` merupakan identifier yang berbeda dan label tampilan mengikuti field yang tersedia.

Halaman Data Guru menyiapkan kontrak frontend tambahan untuk `nip`, `mata_pelajaran`, dan `status`, GET pencarian nama/NIP, serta POST tambah guru. Field request dipusatkan di `TEACHER_FIELDS`/`buildTeacherPayload` pada `src/services/teachers.js`. Kontrak request/respons, alias tampilan, dan kebutuhan backend ada di [teachers-page.md](teachers-page.md). `nip` dan `sn` dibedakan, termasuk label pada kartu.

Metode/URL ubah-hapus siswa dan guru belum diberikan. Helper umum di atas tetap hanya memilih field yang sudah terdaftar pada kontrak awal; token autentikasi diteruskan melalui header oleh Axios instance.

## Profil dan fitur dashboard lainnya

Profil menerima objek pengguna yang sedang login melalui prop `profile`, langsung atau dibungkus `data`. Nama, SN, status, dan tipe mengikuti field API siswa/guru jika objek tersebut merupakan pengguna yang login. Frontend tidak memilih akun dari daftar siswa/guru secara otomatis.

Presensi menggunakan kontrak frontend `POST /api/absensi` dengan `sn` dan `jenis_absensi` (`masuk`/`pulang`). Pemanggilan Axios, konfigurasi endpoint, dan respons yang perlu disediakan backend dijelaskan di [attendance-page.md](attendance-page.md).

Riwayat absensi menggunakan kontrak frontend `GET /api/absensi/riwayat` dengan query `id_kelas`, `tanggal`, dan `page`. Pilihan kelas menggunakan `GET /api/kelas`. Kontrak filter, record nama/status, dan pagination dijelaskan di [attendance-history-page.md](attendance-history-page.md).

Pengelolaan kelas memakai kontrak frontend GET/POST `/api/kelas` dan GET/PUT `/api/kelas/{id_kelas}`. Request tambah/edit berisi `nama_kelas` dan `id_wali_kelas` (string atau null); backend menghitung `jumlah_siswa` dan mengirim nama wali kelas. Pilihan wali diambil dari GET `/api/data_guru`. Kontrak respons, pagination, validasi, dan konfigurasi ada di [classes-page.md](classes-page.md).

Ekstrakurikuler memakai GET/POST `/api/ekstrakurikuler` dan GET/PUT `/api/ekstrakurikuler/{id_ekstrakurikuler}`. Jadwal pelajaran memakai GET/POST `/api/jadwal` dan GET/PUT `/api/jadwal/{id_jadwal}`. Kontrak frontend, field pembina/guru/kelas, waktu WIB, filter, dan validasi backend dijelaskan di [school-activities-api.md](school-activities-api.md).

Foto ekstrakurikuler memakai multipart `foto[]` dan `hapus_foto[]` pada endpoint simpan yang sama; edit foto memakai POST dengan `_method=PUT` untuk Laravel. Galeri carousel memakai GET `/api/ekstrakurikuler/foto?per_page=5`, dengan record `id_foto`, `url`, dan `caption`. Detail format dan kebutuhan penyimpanan backend ada di [kontrak foto](school-activities-api.md#foto-kegiatan-dan-carousel).

Endpoint dan kontrak request profil, ganti password, pelanggaran, dan notifikasi belum diberikan. Navigasi fitur tersebut tetap meneruskan event/callback aplikasi. Form ganti password memvalidasi input secara lokal; payload pengiriman akan mengikuti nama field dan aturan validasi dari endpoint tersebut setelah tersedia. Statistik yang belum mempunyai sumber data tetap menampilkan `—`.

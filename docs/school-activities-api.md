# Ekstrakurikuler dan Jadwal

Sidebar **Ekstrakurikuler** membuka `src/pages/ExtracurricularPage/Extracurricular.jsx`; **Jadwal** membuka `src/pages/SchedulesPage/Schedules.jsx`. Jadwal dipakai untuk jadwal pelajaran mingguan. Keduanya memakai header, sidebar, dan bottom navigasi dashboard, termasuk perbaikan posisi navigasi saat zoom out.

Tersedia pencarian di server (jeda 300 ms atau Enter), filter hari, pagination, detail, tambah, dan edit. Jadwal mempunyai filter kelas tambahan. Perubahan filter kembali ke halaman pertama dan membatalkan request sebelumnya. Loading, hasil kosong, kegagalan/coba lagi, validasi field, dan pencegahan pengiriman ganda ditangani. Aplikasi tidak menyisipkan record contoh.

Kartu jadwal berada di `src/pages/SchedulesPage/ScheduleCard.jsx`: kartu putih, judul biru, label Guru, Kelas, Jam mulai, Jam selesai, Hari, dan Ruangan jika tersedia. Hover/fokus keyboard menampilkan bidang biru yang miring di belakang kartu, bayangan, dan panah detail yang mengarah ke kanan. Tombol panah membuka detail terbaru dari API; **Edit jadwal** membuka form edit. Waktu kartu mengikuti field `jam_mulai`/`jam_selesai` dari API dengan presisi menit. Preferensi reduced motion menonaktifkan animasi transisi.

## Konfigurasi Axios

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_EXTRACURRICULAR_ENDPOINT=/api/ekstrakurikuler
VITE_EXTRACURRICULAR_PHOTOS_ENDPOINT=/api/ekstrakurikuler/foto
VITE_SCHEDULES_ENDPOINT=/api/jadwal
VITE_DATA_GURU_ENDPOINT=/api/data_guru
VITE_CLASSES_ENDPOINT=/api/kelas
```

Sesuaikan `.env.local` jika path backend berbeda, lalu restart Vite. Modul `src/services/extracurricular.js` dan `src/services/schedules.js` memakai Axios instance bersama dari `api.js`, timeout 15 detik, `Accept: application/json`, dan `Authorization: Bearer <auth_token>` dari sesi login. Token tidak disimpan dalam `VITE_*`.

## Endpoint

| Metode | Endpoint default | Fungsi |
| --- | --- | --- |
| GET | `/api/ekstrakurikuler` | Daftar, pencarian nama, filter hari |
| POST | `/api/ekstrakurikuler` | Tambah kegiatan |
| GET | `/api/ekstrakurikuler/foto?per_page=5` | Foto unggulan carousel, terpisah dari filter daftar |
| GET | `/api/ekstrakurikuler/{id_ekstrakurikuler}` | Detail terbaru |
| PUT | `/api/ekstrakurikuler/{id_ekstrakurikuler}` | Ubah kegiatan |
| GET | `/api/jadwal` | Daftar, pencarian mata pelajaran, filter hari/kelas |
| POST | `/api/jadwal` | Tambah jadwal pelajaran |
| GET | `/api/jadwal/{id_jadwal}` | Detail terbaru |
| PUT | `/api/jadwal/{id_jadwal}` | Ubah jadwal pelajaran |
| GET | `/api/data_guru?page=1` | Pilihan pembina/guru, semua halaman diambil |
| GET | `/api/kelas?page=1` | Pilihan kelas, semua halaman diambil |

Query daftar: `search` opsional (teks dipangkas spasi tepinya), `hari` opsional (`senin`, `selasa`, `rabu`, `kamis`, `jumat`, `sabtu`, `minggu`), dan `page` bilangan bulat positif mulai dari 1. GET jadwal juga menerima `id_kelas` opsional sebagai string. Filter kosong dihilangkan dari query. Backend menerapkan pencarian/filter terhadap seluruh koleksi sebelum pagination.

Contoh: `GET /api/jadwal?search=Matematika&hari=senin&id_kelas=001&page=1`.

## Payload tambah dan edit ekstrakurikuler

```json
{
  "nama_ekstrakurikuler": "Pramuka",
  "id_pembina": "002",
  "hari": "sabtu",
  "jam_mulai": "08:00",
  "jam_selesai": "10:00",
  "lokasi": "Lapangan sekolah",
  "deskripsi": "Latihan mingguan",
  "status": "ACTIVE"
}
```

Nama, hari, jam mulai, jam selesai wajib diisi. Pembina opsional: string ID guru atau `null`. Lokasi/deskripsi berupa teks atau `null` bila kosong. Status `ACTIVE` atau `INACTIVE`; form tambah memilih `ACTIVE` secara awal. Frontend tidak mengirim ID record maupun jumlah anggota ketika menyimpan.

### Foto kegiatan dan carousel

Carousel berada **di bawah judul/pengantar dan sebelum pencarian/filter**. Foto bergeser otomatis setiap 5 detik, dilengkapi tombol sebelumnya/berikutnya, titik pilihan, jeda/putar, dan swipe horizontal. Autoplay berhenti sementara saat pointer/fokus berada di carousel, form dibuka, atau tab tidak aktif. Preferensi reduced motion menonaktifkan autoplay pada awal tampilan. Galeri kosong, gagal/coba lagi, dan gambar gagal dimuat memiliki tampilan tersendiri; tidak ada foto contoh yang disisipkan ke aplikasi.

Form tambah dan edit menyediakan input beberapa foto beserta preview. Petunjuk tampil pada form dan komentar kode `src/services/extracurricularPhotos.js`/`src/components/ActivityPhotosInput.jsx`:

- Format **WebP/JPG/JPEG**; GIF/PNG/SVG tidak termasuk format unggah ini.
- Ukuran yang disarankan **1200 × 600 piksel**, landscape **2:1**.
- Target **150–300 KB/foto**; batas validasi **2 MB/foto** dan **5 foto/kegiatan**.
- Dimensi dan target kompresi merupakan saran; preview/carousel memakai crop `object-cover` dengan rasio 2:1. Frontend tidak mengubah file asli.
- Contoh nama: `pramuka.webp`, `futsal.jpg`, `basket.jpeg`.

Tanpa perubahan foto, request tetap memakai JSON POST/PUT seperti kontrak awal. Dengan foto baru atau penghapusan foto tersimpan, request memakai **multipart/form-data**:

```text
POST /api/ekstrakurikuler
nama_ekstrakurikuler: Pramuka
id_pembina: 002
hari: sabtu
jam_mulai: 08:00
jam_selesai: 10:00
lokasi: Lapangan sekolah
deskripsi: Latihan mingguan
status: ACTIVE
foto[]: <binary pramuka.webp>
foto[]: <binary latihan.jpg>
```

Axios/browser menentukan Content-Type dan boundary secara otomatis. Field nullable dikirim sebagai string kosong dalam multipart; backend perlu mengubahnya menjadi `null` (sesuai middleware Laravel ConvertEmptyStringsToNull). Validasi file asli, MIME, ukuran, dan jumlah wajib diulang pada backend.

Untuk **edit yang mengubah foto**, frontend mengirim `POST /api/ekstrakurikuler/{id}` dengan `_method=PUT`. Laravel membaca upload POST multipart dan meneruskannya ke route PUT. `foto[]` menambahkan file baru. `hapus_foto[]` berisi string ID foto tersimpan yang ditandai untuk dihapus. Foto lama tetap dipertahankan jika ID-nya tidak tercantum; upload tidak otomatis mengganti seluruh galeri. Penghapusan baru dilakukan ketika pengguna menekan **Simpan** dan server berhasil menyimpan perubahan. Backend harus memastikan setiap ID foto milik kegiatan/pengguna yang diizinkan dan menjaga maksimum 5 foto setelah penghapusan/penambahan.

Respons record ekstrakurikuler pada daftar, detail, POST, dan PUT dapat memuat:

```json
{
  "id_ekstrakurikuler": "001",
  "nama_ekstrakurikuler": "Pramuka",
  "foto": [
    { "id_foto": "0001", "url": "/storage/ekstrakurikuler/pramuka.webp", "caption": "Latihan Pramuka" },
    { "id_foto": "0002", "url": "/storage/ekstrakurikuler/latihan.jpg", "caption": "Kegiatan mingguan" }
  ]
}
```

URL dapat berupa HTTP(S) absolut atau path relatif backend. `/storage/...` diselesaikan terhadap origin backend dari `VITE_API_BASE_URL`; protokol lain diabaikan. Alias `foto_url` didukung untuk satu foto; ID `id` dan key URL `foto_url` juga didukung pada objek foto. Backend sebaiknya selalu mengirim `id_foto` agar foto lama bisa dihapus dari form edit.

Endpoint galeri `GET /api/ekstrakurikuler/foto?per_page=5` mengembalikan **HTTP 200**, misalnya:

```json
{
  "data": [
    { "id_foto": "0001", "url": "/storage/ekstrakurikuler/pramuka.webp", "caption": "Pramuka" },
    { "id_foto": "0002", "url": "/storage/ekstrakurikuler/futsal.jpg", "caption": "Futsal" }
  ]
}
```

Backend memilih maksimal 5 foto unggulan/terbaru dari kegiatan aktif yang dapat diakses pengguna, terlepas dari pagination/pencarian daftar kegiatan. Array langsung, pembungkus `foto`, dan paginator Laravel didukung; widget memakai halaman pertama sebagai pilihan foto unggulan. Galeri dimuat ulang setelah tambah/edit berhasil. Daftarkan route literal `/ekstrakurikuler/foto` **sebelum** route `/{id_ekstrakurikuler}` atau batasi pola ID agar `foto` tidak dianggap ID kegiatan.

Error validasi **HTTP 422** dapat memakai `foto`, `foto.0`, `foto.1`, atau `hapus_foto.0`; pesan dipetakan ke input foto dan preview/input lain dipertahankan. HTTP 413 perlu disediakan bila batas ukuran server terlampaui. Backend perlu menyimpan file dan metadata foto secara konsisten serta baru menghapus file lama setelah perubahan berhasil. URL gambar harus dapat dibaca browser lewat `<img>`; gunakan URL publik atau URL bertanda tangan jika akses gambar memerlukan otorisasi khusus.

## Payload tambah dan edit jadwal

```json
{
  "id_kelas": "001",
  "id_guru": "002",
  "mata_pelajaran": "Matematika",
  "hari": "senin",
  "jam_mulai": "07:00",
  "jam_selesai": "08:30",
  "ruangan": "R-01"
}
```

Kelas, guru, mata pelajaran, hari, dan kedua jam wajib diisi. Ruangan berupa teks atau `null` bila kosong. Mata pelajaran menggunakan teks sesuai modul Data Guru saat ini. Backend yang memakai relasi ID mata pelajaran perlu menyamakan kontraknya dengan frontend.

Kedua resource memakai waktu mingguan **WIB**, format request `HH:mm`, jam selesai harus setelah jam mulai pada hari yang sama. Backend harus memvalidasi kembali aturan ini. Identifier tetap string, termasuk nol di depan; ID dalam URL di-encode. Input dipangkas spasi tepinya dan hanya field kontrak yang dikirim.

## Respons daftar dan detail

Contoh record ekstrakurikuler:

```json
{
  "id_ekstrakurikuler": "001",
  "nama_ekstrakurikuler": "Pramuka",
  "id_pembina": "002",
  "pembina": { "id_guru": "002", "nama": "Jaka Subagya, S.Pd." },
  "hari": "sabtu",
  "jam_mulai": "08:00:00",
  "jam_selesai": "10:00:00",
  "lokasi": "Lapangan sekolah",
  "deskripsi": "Latihan mingguan",
  "jumlah_anggota": 32,
  "status": "ACTIVE"
}
```

Contoh record jadwal:

```json
{
  "id_jadwal": "001",
  "id_kelas": "001",
  "kelas": { "id_kelas": "001", "nama_kelas": "X AKL" },
  "id_guru": "002",
  "guru": { "id_guru": "002", "nama": "Jaka Subagya, S.Pd." },
  "mata_pelajaran": "Matematika",
  "hari": "senin",
  "jam_mulai": "07:00:00",
  "jam_selesai": "08:30:00",
  "ruangan": "R-01"
}
```

GET daftar mengembalikan **HTTP 200**, contoh pembungkus:

```json
{
  "status": 200,
  "data": [],
  "current_page": 1,
  "last_page": 1,
  "total": 0
}
```

Isi `data` dengan array record di atas. Array langsung, pembungkus `ekstrakurikuler`/`jadwal`, paginator Laravel di dalam `data`, dan metadata resource `meta` didukung. ID dan nama kegiatan/mata pelajaran wajib tersedia. JSON asli dan semua field tambahan dipertahankan di `payload`/`items`.

GET detail dan PUT mengembalikan **HTTP 200**, POST **HTTP 201**, berbentuk `{ "data": record }`. Objek record langsung atau pembungkus resource juga diterima. Respons tambah/edit wajib memuat record tersimpan dengan ID dan nama; respons kosong/204 belum didukung. ID pada detail/edit harus cocok dengan ID yang diminta. Form edit memuat ulang detail, bukan memakai salinan kartu daftar.

Nama pembina dapat berasal dari `nama_pembina` atau `pembina.nama`/`pembina.nama_guru`. Nama guru jadwal dari `nama_guru` atau `guru.nama`/`guru.nama_guru`. Nama kelas dari `nama_kelas` atau `kelas.nama_kelas`/`kelas.nama`. ID relasi dapat berupa field langsung atau ID di objek relasi. Nama record alternatif `nama` untuk ekstrakurikuler dan `nama_mapel` untuk jadwal juga diterima; ID alternatif `id` didukung.

Backend sebaiknya mengirim ID dan nama relasi bersama. Pilihan yang sedang terpasang tetap dipertahankan bila tidak muncul dalam daftar guru/kelas. Jika respons hanya memuat nama tanpa ID, pengguna perlu memilih relasi kembali saat edit. Jumlah anggota berasal dari `jumlah_anggota`/`anggota_count`; 0 tetap 0, sedangkan jumlah yang belum tersedia ditampilkan `—`. UI tidak menghitung jumlah anggota dari satu halaman daftar siswa. Respons `HH:mm:ss` ditampilkan dan diisi ke form dengan presisi menit.

## Validasi dan konflik

Contoh **HTTP 422**:

```json
{
  "message": "Data belum valid.",
  "errors": {
    "id_guru": ["Guru tidak ditemukan."],
    "jam_selesai": ["Jam selesai harus setelah jam mulai."]
  }
}
```

Gunakan nama field yang sama dengan request agar error muncul pada input yang benar. Form tetap terbuka dan input dipertahankan. **HTTP 409** dipakai untuk konflik jadwal guru, kelas, ruangan, atau duplikasi data. HTTP 401/403/404/429, koneksi gagal, dan timeout ditangani. JSON `status: false`, `success: false`, atau status 400–599 tetap dianggap gagal walaupun HTTP 200.

Setelah sukses, daftar dimuat ulang. Tambah mengosongkan filter agar record baru dapat ditemukan; edit mempertahankan filter aktif. Selama request simpan, form/penutup dinonaktifkan dan pengiriman ganda ditahan. Modal mendukung Escape, fokus keyboard, serta pembatalan request saat dilepas. Pada timeout, periksa daftar sebelum mencoba lagi karena server mungkin telah menerima perubahan.

## Kebutuhan backend

Repository ini berisi frontend React; route/controller, migration, dan database Laravel untuk kedua resource belum ada. Backend perlu menyediakan endpoint di atas, validasi token dan izin, pengecekan relasi guru/kelas, perhitungan jumlah anggota, serta pengecekan bentrok jadwal secara atomik. Izinkan CORS untuk GET/POST/PUT/OPTIONS dan header Accept/Content-Type/Authorization. Integrasi dengan backend asli perlu diuji setelah route tersedia; tes frontend memakai server HTTP lokal dan API mock.

```js
import { extracurricularApi } from "../services/extracurricular.js";
import { schedulesApi } from "../services/schedules.js";

const options = { signal: new AbortController().signal };
await extracurricularApi.list({ search: "Pramuka", hari: "sabtu", page: 1 }, options);
await schedulesApi.list({ hari: "senin", id_kelas: "001", page: 1 }, options);
await schedulesApi.detail("001", options);
await schedulesApi.create({ id_kelas: "001", id_guru: "002", mata_pelajaran: "Matematika", hari: "senin", jam_mulai: "07:00", jam_selesai: "08:30", ruangan: "R-01" }, options);
```

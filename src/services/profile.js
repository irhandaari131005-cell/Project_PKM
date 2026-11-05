import { request } from "./api.js";
import { resolvePhotoUrl } from "./extracurricularPhotos.js";

const env = import.meta.env ?? {};
const PROFILE_ENDPOINT = env.VITE_PROFILE_ENDPOINT || "/api/profile";

export const PROFILE_PHOTO_HINT = "WebP/JPG/JPEG · maksimal 2 MB · disarankan persegi (mis. 400 × 400 piksel).";
export const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

// Field yang boleh diubah sendiri. SN, tipe, dan status sengaja tidak ada di sini.
export const PROFILE_FIELDS = Object.freeze(["nama", "tempat_lahir", "tanggal_lahir", "alamat", "no_telp"]);

function profileValidationError(errors) {
  const error = new Error("Periksa kembali data profil.");
  error.status = 422;
  error.response = { status: 422, data: { errors } };
  return error;
}

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function validateProfilePhoto(file) {
  if (file == null) return null;
  if (!(file instanceof Blob) || typeof file.name !== "string"
    || !["image/webp", "image/jpeg"].includes(file.type) || !/\.(webp|jpe?g)$/i.test(file.name)) {
    return "Format foto harus WebP, JPG, atau JPEG.";
  }
  if (!file.size || file.size > MAX_PROFILE_PHOTO_BYTES) return "Ukuran foto maksimal 2 MB.";
  return null;
}

/** Validasi di browser dengan aturan yang sama seperti backend (backend tetap memvalidasi ulang). */
export function buildProfilePayload(values = {}) {
  const errors = {};
  const read = (field) => (typeof values[field] === "string" ? values[field].trim() : "");

  const nama = read("nama");
  if (!nama) errors.nama = ["Nama wajib diisi."];
  else if (nama.length > 100) errors.nama = ["Nama maksimal 100 karakter."];

  const tempat_lahir = read("tempat_lahir");
  if (tempat_lahir.length > 100) errors.tempat_lahir = ["Tempat lahir maksimal 100 karakter."];

  const tanggal_lahir = read("tanggal_lahir");
  if (tanggal_lahir) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal_lahir);
    const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
    if (!date || date.getUTCDate() !== +match[3] || date.getUTCMonth() !== +match[2] - 1) {
      errors.tanggal_lahir = ["Tanggal lahir tidak valid."];
    } else if (tanggal_lahir < "1900-01-01" || tanggal_lahir > todayInJakarta()) {
      errors.tanggal_lahir = ["Tanggal lahir tidak boleh di masa depan atau sebelum tahun 1900."];
    }
  }

  const alamat = read("alamat");
  if (alamat.length > 255) errors.alamat = ["Alamat maksimal 255 karakter."];

  const no_telp = read("no_telp").replace(/[\s\-.()]/g, "");
  if (no_telp && !/^\+?[0-9]{8,15}$/.test(no_telp)) errors.no_telp = ["No telp harus berisi 8–15 angka, boleh diawali +."];

  const photoError = validateProfilePhoto(values.foto ?? null);
  if (photoError) errors.foto = [photoError];

  if (Object.keys(errors).length) throw profileValidationError(errors);
  return { nama, tempat_lahir, tanggal_lahir, alamat, no_telp };
}

/** Ubah respons backend menjadi bentuk yang dipakai halaman profil. */
export function getProfileFormValues(profile = {}) {
  const text = (value) => (typeof value === "string" ? value : "");
  return {
    nama: text(profile.nama),
    tempat_lahir: text(profile.tempat_lahir),
    tanggal_lahir: text(profile.tanggal_lahir),
    alamat: text(profile.alamat),
    no_telp: text(profile.no_telp),
    foto: null,
    hapus_foto: false,
  };
}

function unwrapProfile(payload) {
  const status = Number(payload?.status);
  if (!payload || typeof payload !== "object" || (status >= 400 && status <= 599)) {
    const error = new Error("Profil belum dapat dimuat.");
    error.response = { status: status >= 400 ? status : 500, data: payload };
    throw error;
  }
  const data = payload.data ?? payload;
  if (!data || typeof data !== "object" || Array.isArray(data) || data.id_user == null) {
    throw new Error("Format respons profil belum sesuai.");
  }
  return { ...data, foto_url: data.foto_url ? resolvePhotoUrl(data.foto_url) : "" };
}

export const profileApi = {
  async get({ signal } = {}) {
    return unwrapProfile(await request(PROFILE_ENDPOINT, { method: "get", signal }));
  },
  async update(values, { signal } = {}) {
    const payload = buildProfilePayload(values);
    if (!values.foto && !values.hapus_foto) {
      return unwrapProfile(await request(PROFILE_ENDPOINT, { method: "put", data: payload, signal }));
    }
    // Ada foto: kirim multipart lewat POST + _method=PUT (PHP hanya membaca file pada POST).
    const data = new FormData();
    for (const [field, value] of Object.entries(payload)) data.append(field, value);
    if (values.foto) data.append("foto", values.foto, values.foto.name);
    else data.append("hapus_foto", "1");
    data.append("_method", "PUT");
    return unwrapProfile(await request(PROFILE_ENDPOINT, { method: "post", data, signal }));
  },
};

export function getProfileError(error, action = "load") {
  const status = error?.response?.status ?? error?.status;
  const fields = {};
  if (status === 422) {
    for (const [field, value] of Object.entries(error.response?.data?.errors || {})) {
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") fields[field] = message;
    }
  }
  let message = action === "save" ? "Profil belum dapat disimpan. Silakan coba lagi." : "Profil belum dapat dimuat. Silakan coba lagi.";
  if (status === 401) message = "Sesi berakhir. Silakan login kembali.";
  else if (status === 404) message = "Profil tidak ditemukan.";
  else if (status === 409) message = error.response?.data?.message || "Data profil belum terdaftar. Hubungi admin sekolah.";
  else if (status === 413) message = "Ukuran foto melebihi batas server. Kecilkan foto lalu coba lagi.";
  else if (status === 422) message = "Periksa kembali data yang diisi.";
  else if (["ECONNABORTED", "ETIMEDOUT"].includes(error?.code)) message = "Server belum merespons. Silakan coba lagi.";
  else if (error?.code === "ERR_NETWORK") message = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return { message, fields };
}

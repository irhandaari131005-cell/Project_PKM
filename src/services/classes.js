import { request } from "./api.js";
import { normalizeHistoryCollection } from "./attendanceHistory.js";
import { teachersApi } from "./teachers.js";

const env = import.meta.env ?? {};
const CLASSES_ENDPOINT = (env.VITE_CLASSES_ENDPOINT || "/api/kelas").replace(/\/+$/, "");

export const CLASS_FIELDS = Object.freeze({ nama_kelas: "nama_kelas", id_wali_kelas: "id_wali_kelas" });

function invalid(errors) {
  const error = new Error("Periksa kembali data kelas.");
  error.response = { status: 422, data: { errors } };
  return error;
}

function text(value) {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

export function getClassView(record) {
  const teacher = record.wali_kelas;
  const rawCount = record.jumlah_siswa ?? record.siswa_count ?? record.students_count;
  const count = rawCount !== "" && rawCount != null && typeof rawCount !== "boolean" ? Number(rawCount) : NaN;
  return {
    id: text(record.id_kelas ?? record.id),
    name: text(record.nama_kelas ?? record.nama),
    studentCount: Number.isSafeInteger(count) && count >= 0 ? count : null,
    teacherId: text(record.id_wali_kelas ?? teacher?.id_guru ?? teacher?.id),
    teacherName: text(record.nama_wali_kelas ?? (typeof teacher === "object" && teacher ? teacher.nama ?? teacher.nama_guru ?? teacher.name : teacher)) || "—",
  };
}

export function buildClassSearchParams({ search = "", page = 1 } = {}) {
  if (typeof search !== "string" || !Number.isSafeInteger(page) || page < 1) {
    throw invalid({ search: ["Pencarian atau halaman tidak valid."] });
  }
  return { page, ...(search.trim() ? { search: search.trim() } : {}) };
}

export function buildClassPayload(values = {}) {
  const errors = {};
  if (typeof values?.nama_kelas !== "string" || !values.nama_kelas.trim()) errors.nama_kelas = ["Nama kelas wajib diisi."];
  if (values?.id_wali_kelas != null && typeof values.id_wali_kelas !== "string") errors.id_wali_kelas = ["Pilih wali kelas yang valid."];
  if (Object.keys(errors).length) throw invalid(errors);
  return { nama_kelas: values.nama_kelas.trim(), id_wali_kelas: values.id_wali_kelas?.trim() || null };
}

function classPath(id) {
  if (typeof id !== "string" || !id.trim() || [".", ".."].includes(id.trim())) throw invalid({ id_kelas: ["ID kelas tidak valid."] });
  return `${CLASSES_ENDPOINT}/${encodeURIComponent(id.trim())}`;
}

function unwrapClass(payload) {
  let record = payload;
  for (let depth = 0; depth < 5 && record && typeof record === "object" && !Array.isArray(record); depth++) {
    const status = Number(record.status);
    if ((status >= 400 && status <= 599) || record.status === false || record.success === false) {
      const error = new Error("Permintaan data kelas belum berhasil.");
      error.response = { status: status >= 400 && status <= 599 ? status : 422, data: record };
      throw error;
    }
    if (record.kelas != null) record = record.kelas;
    else if (record.data != null) record = record.data;
    else break;
  }
  if (!record || typeof record !== "object" || Array.isArray(record) || !getClassView(record).id || !getClassView(record).name) {
    throw new Error("Respons kelas harus memuat ID dan nama kelas.");
  }
  return record;
}

export function normalizeClassRecord(payload, expectedId) {
  const record = unwrapClass(payload);
  if (expectedId != null && getClassView(record).id !== expectedId.trim()) throw new Error("ID pada respons kelas belum sesuai.");
  return { payload, record };
}

export const classesApi = {
  async list(filters, { signal } = {}) {
    const params = buildClassSearchParams(filters);
    const payload = await request(CLASSES_ENDPOINT, { method: "get", params, signal });
    const collection = normalizeHistoryCollection(payload, "kelas", params.page);
    if (collection.currentPage !== params.page) throw new Error("Halaman daftar kelas belum sesuai.");
    for (const record of collection.items) {
      const item = getClassView(record);
      if (!item.id || !item.name) throw new Error("Data kelas harus memuat ID dan nama kelas.");
    }
    return collection;
  },
  async detail(id, { signal } = {}) {
    const payload = await request(classPath(id), { method: "get", signal });
    return normalizeClassRecord(payload, id);
  },
  async create(values, { signal } = {}) {
    const payload = await request(CLASSES_ENDPOINT, { method: "post", data: buildClassPayload(values), signal });
    return { ...normalizeClassRecord(payload), message: "Data kelas berhasil ditambahkan." };
  },
  async update(id, values, { signal } = {}) {
    const payload = await request(classPath(id), { method: "put", data: buildClassPayload(values), signal });
    return { ...normalizeClassRecord(payload, id), message: "Data kelas berhasil diperbarui." };
  },
  async remove(id, { signal } = {}) {
    const payload = await request(classPath(id), { method: "delete", signal });
    const status = Number(payload?.status);
    if ((status >= 400 && status <= 599) || payload?.status === false || payload?.success === false) {
      const error = new Error("Data kelas belum berhasil dihapus.");
      error.response = { status: status >= 400 && status <= 599 ? status : 422, data: payload };
      throw error;
    }
    return { payload, message: "Data kelas berhasil dihapus." };
  },
  async getTeachers({ signal } = {}) {
    const items = [];
    const seen = new Set();
    let page = 1, lastPage = 1;
    do {
      const payload = await teachersApi.list({ page }, { signal });
      const collection = normalizeHistoryCollection(payload, "data_guru", page);
      if (collection.currentPage !== page) throw new Error("Halaman pilihan wali kelas belum sesuai.");
      for (const record of collection.items) {
        const id = text(record.id_guru ?? record.id);
        const name = text(record.nama ?? record.nama_guru ?? record.name);
        if (!id || !name) throw new Error("Data wali kelas harus memuat ID dan nama guru.");
        if (!seen.has(id)) { items.push({ id, name }); seen.add(id); }
      }
      lastPage = collection.lastPage;
      page++;
    } while (page <= lastPage);
    return items;
  },
};

export function getClassError(error, action = "load") {
  const status = error.response?.status;
  const fields = {};
  // 409 juga membawa errors per field (mis. nama kelas/wali kelas sudah dipakai) agar tampil di bawah input.
  if (status === 422 || status === 409) {
    for (const field of [...Object.keys(CLASS_FIELDS), "id_kelas", "search"]) {
      const value = error.response?.data?.errors?.[field];
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") fields[field] = message;
    }
  }
  const serverMessage = typeof error.response?.data?.message === "string" ? error.response.data.message.trim() : "";
  let message = action === "save" ? "Data kelas belum dapat disimpan. Silakan coba lagi."
    : action === "delete" ? "Data kelas belum dapat dihapus. Silakan coba lagi."
      : "Data kelas belum dapat dimuat. Silakan coba lagi.";
  if (status === 401) message = "Sesi berakhir. Silakan login kembali.";
  else if (status === 403) message = "Anda tidak memiliki izin mengakses atau mengubah data kelas.";
  else if (status === 404) message = "Kelas tidak ditemukan. Muat ulang daftar kelas.";
  // Pesan server paling jelas: "Nama kelas sudah dipakai." / "Kelas masih memiliki siswa...".
  else if (status === 409) message = serverMessage || "Data kelas berbenturan dengan data yang sudah ada. Periksa nama dan wali kelas.";
  else if (status === 422) message = "Periksa kembali data yang diisi.";
  else if (status === 429) message = "Terlalu banyak permintaan. Silakan tunggu sebentar.";
  else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") message = "Server belum merespons. Periksa data sebelum mencoba lagi.";
  else if (error.code === "ERR_NETWORK") message = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return { message, fields };
}

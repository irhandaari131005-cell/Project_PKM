import { request } from "./api.js";

const env = import.meta.env ?? {};
const HISTORY_ENDPOINT = env.VITE_ATTENDANCE_HISTORY_ENDPOINT || "/api/absensi/riwayat";
const CLASSES_ENDPOINT = env.VITE_DATA_KELAS_ENDPOINT || env.VITE_CLASSES_ENDPOINT || "/api/data_kelas";

export const HISTORY_FILTER_FIELDS = Object.freeze({ id_kelas: "id_kelas", tanggal: "tanggal", page: "page" });
const jakartaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
});

export function getJakartaDate(now = new Date()) {
  const parts = Object.fromEntries(jakartaDate.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isValidHistoryDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function buildHistoryParams({ id_kelas = "", tanggal, page = 1 }) {
  const errors = {};
  if (!isValidHistoryDate(tanggal)) errors[HISTORY_FILTER_FIELDS.tanggal] = ["Pilih tanggal yang valid."];
  if (typeof id_kelas !== "string") errors[HISTORY_FILTER_FIELDS.id_kelas] = ["ID kelas harus berupa string."];
  if (!Number.isSafeInteger(page) || page < 1) errors[HISTORY_FILTER_FIELDS.page] = ["Halaman tidak valid."];
  if (Object.keys(errors).length) {
    const error = new Error("Filter riwayat absensi tidak valid.");
    error.response = { status: 422, data: { errors } };
    throw error;
  }
  const params = { [HISTORY_FILTER_FIELDS.tanggal]: tanggal, [HISTORY_FILTER_FIELDS.page]: page };
  if (id_kelas.trim()) params[HISTORY_FILTER_FIELDS.id_kelas] = id_kelas.trim();
  return params;
}

function nonNegativeInteger(value) {
  if (value === "" || value == null || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function normalizeHistoryCollection(payload, resource = "riwayat", requestedPage = 1) {
  const envelopes = [];
  let records = payload;
  for (let depth = 0; depth < 5 && !Array.isArray(records); depth++) {
    if (!records || typeof records !== "object") break;
    const status = Number(records.status);
    if ((status >= 400 && status <= 599) || records.status === false || records.success === false) {
      const error = new Error("Pengambilan data belum berhasil.");
      error.response = { status: status >= 400 && status <= 599 ? status : 422, data: records };
      throw error;
    }
    envelopes.push(records);
    records = records[resource] ?? records.data;
  }
  if (!Array.isArray(records) || records.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`Format respons ${resource} harus berupa daftar data.`);
  }
  function metadata(key) {
    for (let index = envelopes.length - 1; index >= 0; index--) {
      const value = envelopes[index].meta?.[key] ?? envelopes[index][key];
      if (value != null) return value;
    }
    return undefined;
  }
  const currentPage = Math.max(1, nonNegativeInteger(metadata("current_page")) ?? requestedPage);
  const lastPage = Math.max(currentPage, nonNegativeInteger(metadata("last_page")) ?? currentPage);
  const perPage = nonNegativeInteger(metadata("per_page"));
  const from = nonNegativeInteger(metadata("from"));
  return {
    payload, items: records, currentPage, lastPage,
    offset: from !== null && from > 0 ? from - 1 : perPage ? (currentPage - 1) * perPage : 0,
  };
}

function textValue(value) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

export function getHistoryRow(record) {
  const status = textValue(record.status_kehadiran ?? record.status);
  const labels = { hadir: "Hadir", izin: "Izin", sakit: "Sakit", alpa: "Alpa", alpha: "Alpa", terlambat: "Terlambat" };
  return {
    id: textValue(record.id_absensi ?? record.id ?? record.id_siswa ?? record.sn),
    name: textValue(record.nama_siswa ?? record.nama ?? record.siswa?.nama_siswa ?? record.siswa?.nama) || "—",
    className: textValue(record.nama_kelas ?? record.kelas?.nama_kelas ?? record.siswa?.kelas?.nama_kelas) || "Belum ada kelas",
    status: labels[status.toLowerCase().trim()] || status || "—",
  };
}

export const attendanceHistoryApi = {
  async getClasses({ signal } = {}) {
    const items = [];
    let page = 1;
    let lastPage = 1;
    do {
      const payload = await request(CLASSES_ENDPOINT, { method: "get", params: { page }, signal });
      const collection = normalizeHistoryCollection(payload, "kelas", page);
      if (collection.currentPage !== page) throw new Error("Halaman daftar kelas belum sesuai.");
      for (const record of collection.items) {
        const id = textValue(record.id_kelas ?? record.id);
        const name = textValue(record.nama_kelas ?? record.nama);
        if (!id || !name) throw new Error("Data kelas harus memuat ID dan nama kelas.");
        if (!items.some((item) => item.id === id)) items.push({ id, name, record });
      }
      lastPage = collection.lastPage;
      page++;
    } while (page <= lastPage);
    return items;
  },
  async getHistory(filters, { signal } = {}) {
    const params = buildHistoryParams(filters);
    const payload = await request(HISTORY_ENDPOINT, { method: "get", params, signal });
    return normalizeHistoryCollection(payload, "riwayat", filters.page ?? 1);
  },
};

export function getHistoryError(error, label = "Riwayat absensi") {
  const status = error.response?.status;
  const fields = {};
  if (status === 422) {
    for (const [field, key] of Object.entries(HISTORY_FILTER_FIELDS)) {
      const value = error.response?.data?.errors?.[key];
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") fields[field] = message;
    }
  }
  let message = `${label} belum dapat dimuat. Silakan coba lagi.`;
  if (status === 401) message = "Sesi berakhir. Silakan login kembali.";
  else if (status === 403) message = `Anda tidak memiliki akses ke ${label.toLowerCase()}.`;
  else if (status === 422) message = fields.tanggal || fields.id_kelas || fields.page || "Periksa kembali filter riwayat absensi.";
  else if (status === 429) message = "Terlalu banyak permintaan. Silakan tunggu sebentar.";
  else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") message = `Waktu tunggu ${label.toLowerCase()} habis. Silakan coba lagi.`;
  else if (error.code === "ERR_NETWORK") message = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return { message, fields };
}

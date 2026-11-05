import { request } from "./api.js";
import { normalizeHistoryCollection } from "./attendanceHistory.js";

export const SCHOOL_DAYS = Object.freeze([
  { value: "senin", label: "Senin" }, { value: "selasa", label: "Selasa" },
  { value: "rabu", label: "Rabu" }, { value: "kamis", label: "Kamis" },
  { value: "jumat", label: "Jumat" }, { value: "sabtu", label: "Sabtu" },
  { value: "minggu", label: "Minggu" },
]);

export function text(value) {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

export function validationError(errors) {
  const error = new Error("Periksa kembali data yang diisi.");
  error.response = { status: 422, data: { errors } };
  return error;
}

export function buildActivityFilters(filters = {}, withClass = false) {
  const { search = "", hari = "", page = 1, id_kelas = "" } = filters;
  const errors = {};
  if (typeof search !== "string") errors.search = ["Pencarian harus berupa teks."];
  if (typeof hari !== "string" || (hari && !SCHOOL_DAYS.some((day) => day.value === hari))) errors.hari = ["Pilih hari yang valid."];
  if (!Number.isSafeInteger(page) || page < 1) errors.page = ["Halaman tidak valid."];
  if (withClass && typeof id_kelas !== "string") errors.id_kelas = ["ID kelas harus berupa string."];
  if (Object.keys(errors).length) throw validationError(errors);
  return { page, ...(search.trim() ? { search: search.trim() } : {}), ...(hari ? { hari } : {}), ...(withClass && id_kelas.trim() ? { id_kelas: id_kelas.trim() } : {}) };
}

export function readText(values, field, label, errors, required = false) {
  const value = values?.[field];
  if ((value != null && typeof value !== "string") || (required && (typeof value !== "string" || !value.trim()))) {
    errors[field] = [`${label} ${required ? "wajib diisi dengan benar" : "harus berupa teks"}.`];
  }
  return typeof value === "string" ? value.trim() : "";
}

export function readMeetingTime(values, errors) {
  const hari = readText(values, "hari", "Hari", errors, true).toLowerCase();
  if (!SCHOOL_DAYS.some((day) => day.value === hari)) errors.hari = ["Pilih hari yang valid."];
  const times = {};
  for (const [field, label] of [["jam_mulai", "Jam mulai"], ["jam_selesai", "Jam selesai"]]) {
    times[field] = readText(values, field, label, errors, true);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(times[field])) errors[field] = [`${label} harus berformat HH:mm.`];
  }
  if (!errors.jam_mulai && !errors.jam_selesai && times.jam_selesai <= times.jam_mulai) errors.jam_selesai = ["Jam selesai harus setelah jam mulai pada hari yang sama."];
  return { hari, ...times };
}

export function viewTime(value) {
  const raw = text(value);
  // Laravel TIME may include seconds; forms and cards use minute precision.
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(raw) ? raw.slice(0, 5) : raw;
}

export function dayLabel(value) {
  const raw = text(value);
  return SCHOOL_DAYS.find((day) => day.value === raw.toLowerCase())?.label || raw || "—";
}

export function createActivityApi({ endpoint, resource, view, buildPayload, withClass = false, prepareWrite = (payload, values, method) => ({ method, data: payload }) }) {
  const base = endpoint.replace(/\/+$/, "");
  function itemPath(id) {
    if (typeof id !== "string" || !id.trim() || [".", ".."].includes(id.trim())) throw validationError({ id: ["ID data tidak valid."] });
    return `${base}/${encodeURIComponent(id.trim())}`;
  }
  function assertRecord(record) {
    if (!record || typeof record !== "object" || Array.isArray(record) || !view(record).id || !view(record).title) throw new Error(`Respons ${resource} harus memuat ID dan nama.`);
  }
  function normalizeRecord(payload, expectedId) {
    let record = payload;
    for (let depth = 0; depth < 5 && record && typeof record === "object" && !Array.isArray(record); depth++) {
      const status = Number(record.status);
      if ((status >= 400 && status <= 599) || record.status === false || record.success === false) {
        const error = new Error("Permintaan belum berhasil.");
        error.response = { status: status >= 400 && status <= 599 ? status : 422, data: record };
        throw error;
      }
      if (record[resource] != null) record = record[resource];
      else if (record.data != null) record = record.data;
      else break;
    }
    assertRecord(record);
    if (expectedId != null && view(record).id !== expectedId.trim()) throw new Error("ID respons berbeda dari data yang diminta.");
    return { payload, record };
  }
  return {
    async list(filters, { signal } = {}) {
      const params = buildActivityFilters(filters, withClass);
      const payload = await request(base, { method: "get", params, signal });
      const collection = normalizeHistoryCollection(payload, resource, params.page);
      if (collection.currentPage !== params.page) throw new Error("Halaman respons belum sesuai.");
      collection.items.forEach(assertRecord);
      return collection;
    },
    async detail(id, { signal } = {}) {
      return normalizeRecord(await request(itemPath(id), { method: "get", signal }), id);
    },
    async create(values, { signal } = {}) {
      return normalizeRecord(await request(base, { ...prepareWrite(buildPayload(values), values, "post"), signal }));
    },
    async update(id, values, { signal } = {}) {
      return normalizeRecord(await request(itemPath(id), { ...prepareWrite(buildPayload(values), values, "put"), signal }), id);
    },
  };
}

export function getActivityError(error, action = "load") {
  const status = error.response?.status;
  const fields = {};
  if (status === 422) {
    for (const [field, value] of Object.entries(error.response?.data?.errors || {})) {
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") {
        fields[field] = message;
        if (/^(foto|hapus_foto)(\.|$)/.test(field)) fields.foto ??= message;
      }
    }
  }
  let message = action === "save" ? "Data belum dapat disimpan. Silakan coba lagi." : "Data belum dapat dimuat. Silakan coba lagi.";
  if (status === 401) message = "Sesi berakhir. Silakan login kembali.";
  else if (status === 403) message = "Anda tidak memiliki izin untuk mengakses atau mengubah data ini.";
  else if (status === 404) message = "Data tidak ditemukan. Muat ulang daftar.";
  else if (status === 409) {
    // Backend menyebut jadwal mana yang bentrok; tampilkan apa adanya bila tersedia.
    const serverMessage = error.response?.data?.message;
    message = typeof serverMessage === "string" && serverMessage.trim()
      ? serverMessage.trim()
      : "Jadwal atau data berbenturan. Periksa hari, jam, guru, dan ruangan.";
  }
  else if (status === 413) message = "Ukuran unggahan melebihi batas server. Kecilkan foto sebelum mencoba lagi.";
  else if (status === 422) message = "Periksa kembali data yang diisi.";
  else if (status === 429) message = "Terlalu banyak permintaan. Silakan tunggu sebentar.";
  else if (["ECONNABORTED", "ETIMEDOUT"].includes(error.code)) message = "Server belum merespons. Periksa data sebelum mencoba lagi.";
  else if (error.code === "ERR_NETWORK") message = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return { message, fields };
}

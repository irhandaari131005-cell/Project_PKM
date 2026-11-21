import { request } from "./api.js";
import { attendanceHistoryApi } from "./attendanceHistory.js";

const env = import.meta.env ?? {};
const STUDENTS_ENDPOINT = env.VITE_DATA_SISWA_ENDPOINT || "/api/data_siswa";
export const STUDENT_FIELDS = Object.freeze({ nama_siswa: "nama_siswa", nis: "nis", id_kelas: "id_kelas", sn: "sn" });

function validationError(errors) {
  const error = new Error("Periksa kembali data siswa.");
  error.response = { status: 422, data: { errors } };
  return error;
}

export function buildStudentSearchParams({ search = "", page = 1 } = {}) {
  if (typeof search !== "string" || !Number.isSafeInteger(page) || page < 1) {
    throw validationError({ search: ["Pencarian atau halaman tidak valid."] });
  }
  return { page, ...(search.trim() ? { search: search.trim() } : {}) };
}

export function buildStudentPayload(values) {
  const errors = {};
  for (const [field, label] of [["nama_siswa", "Nama siswa"], ["nis", "NIS"], ["id_kelas", "Kelas"]]) {
    if (typeof values[field] !== "string" || !values[field].trim()) errors[STUDENT_FIELDS[field]] = [`${label} wajib diisi.`];
  }
  if (values.sn != null && typeof values.sn !== "string") errors[STUDENT_FIELDS.sn] = ["Nomor kartu harus berupa string."];
  if (Object.keys(errors).length) throw validationError(errors);
  const payload = Object.fromEntries(["nama_siswa", "nis", "id_kelas"].map((field) => [STUDENT_FIELDS[field], values[field].trim()]));
  if (values.sn?.trim()) payload[STUDENT_FIELDS.sn] = values.sn.trim();
  return { ...payload, status: "ACTIVE", type: "siswa" };
}

export function assertStudentResponse(payload) {
  let current = payload;
  for (let depth = 0; depth < 5 && current && typeof current === "object" && !Array.isArray(current); depth++) {
    const status = Number(current.status);
    if ((status >= 400 && status <= 599) || current.status === false || current.success === false) {
      const error = new Error("Permintaan data siswa belum berhasil.");
      error.response = { status: status >= 400 && status <= 599 ? status : 422, data: current };
      throw error;
    }
    current = current.data_siswa ?? current.data;
  }
  return payload;
}

export function normalizeCreatedStudent(payload) {
  assertStudentResponse(payload);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Respons penambahan siswa belum sesuai.");
  const record = payload.data ?? payload;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Data siswa pada respons belum sesuai.");
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (record.id_siswa == null && record.id == null && !message && Number(payload.status) !== 201 && payload.success !== true) {
    throw new Error("Respons belum mengonfirmasi penyimpanan siswa.");
  }
  return { payload, record, message: message || "Data siswa berhasil ditambahkan." };
}

export const STUDENT_STATUSES = Object.freeze([
  Object.freeze({ value: "ACTIVE", label: "Aktif" }),
  Object.freeze({ value: "INACTIVE", label: "Nonaktif" }),
]);

/** Payload ubah siswa. SN kosong dikirim null (hapus kartu); backend menolak bila siswa sudah berakun. */
export function buildStudentUpdatePayload(values = {}) {
  const errors = {};
  for (const [field, label] of [["nama_siswa", "Nama siswa"], ["nis", "NIS"], ["id_kelas", "Kelas"]]) {
    if (typeof values?.[field] !== "string" || !values[field].trim()) errors[STUDENT_FIELDS[field]] = [`${label} wajib diisi.`];
  }
  if (values?.sn != null && typeof values.sn !== "string") errors[STUDENT_FIELDS.sn] = ["Nomor kartu harus berupa string."];
  if (!STUDENT_STATUSES.some(({ value }) => value === values?.status)) errors.status = ["Pilih status Aktif atau Nonaktif."];
  if (Object.keys(errors).length) throw validationError(errors);
  return {
    nama_siswa: values.nama_siswa.trim(),
    nis: values.nis.trim(),
    id_kelas: values.id_kelas.trim(),
    sn: values.sn?.trim() || null,
    status: values.status,
  };
}

function studentPath(id) {
  const value = typeof id === "number" ? String(id) : id;
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value.trim())) throw validationError({ id_siswa: ["ID siswa tidak valid."] });
  return `${STUDENTS_ENDPOINT.replace(/\/+$/, "")}/${value.trim()}`;
}

export const studentsApi = {
  async list(filters, { signal } = {}) {
    const payload = await request(STUDENTS_ENDPOINT, { method: "get", params: buildStudentSearchParams(filters), signal });
    return assertStudentResponse(payload);
  },
  getClasses: attendanceHistoryApi.getClasses,
  async create(values, { signal } = {}) {
    const payload = await request(STUDENTS_ENDPOINT, { method: "post", data: buildStudentPayload(values), signal });
    return normalizeCreatedStudent(payload);
  },
  async update(id, values, { signal } = {}) {
    const payload = await request(studentPath(id), { method: "put", data: buildStudentUpdatePayload(values), signal });
    assertStudentResponse(payload);
    const record = payload?.data;
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Respons perubahan siswa belum sesuai.");
    return { payload, record, message: typeof payload.message === "string" && payload.message.trim() ? payload.message.trim() : "Data siswa berhasil diperbarui." };
  },
  async remove(id, { signal } = {}) {
    const payload = await request(studentPath(id), { method: "delete", signal });
    assertStudentResponse(payload);
    return { payload, message: typeof payload?.message === "string" && payload.message.trim() ? payload.message.trim() : "Data siswa berhasil dihapus." };
  },
};

const STUDENT_ACTIONS = {
  load: ["Data siswa belum dapat dimuat. Silakan coba lagi.", "Anda tidak memiliki akses ke data siswa."],
  save: ["Data siswa belum dapat disimpan. Silakan coba lagi.", "Anda tidak memiliki izin menambah siswa."],
  update: ["Perubahan data siswa belum dapat disimpan. Silakan coba lagi.", "Anda tidak memiliki izin mengubah data siswa."],
  delete: ["Data siswa belum dapat dihapus. Silakan coba lagi.", "Anda tidak memiliki izin menghapus data siswa."],
};

export function getStudentError(error, action = "load") {
  const status = error.response?.status ?? error.status;
  const fields = {};
  if (status === 422) {
    for (const [field, key] of [...Object.entries(STUDENT_FIELDS), ["status", "status"], ["search", "search"]]) {
      const value = error.response?.data?.errors?.[key];
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") fields[field] = message;
    }
  }
  const [fallback, forbidden] = STUDENT_ACTIONS[action] ?? STUDENT_ACTIONS.load;
  const serverMessage = typeof error.response?.data?.message === "string" ? error.response.data.message.trim() : "";
  let message = fallback;
  if (status === 401) message = "Sesi berakhir. Silakan login kembali.";
  else if (status === 403) message = forbidden;
  else if (status === 404 && action !== "load") message = "Data siswa tidak ditemukan. Muat ulang daftar siswa.";
  // Mis. "Siswa ini sudah memiliki riwayat absensi sehingga tidak dapat dihapus..."
  else if (status === 409) message = serverMessage || "NIS atau nomor kartu sudah digunakan. Periksa kembali data siswa.";
  else if (status === 422) message = "Periksa kembali data yang diisi.";
  else if (status === 429) message = "Terlalu banyak permintaan. Silakan tunggu sebentar.";
  else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") message = "Server belum merespons. Silakan periksa data sebelum mencoba lagi.";
  else if (error.code === "ERR_NETWORK") message = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return { message, fields };
}

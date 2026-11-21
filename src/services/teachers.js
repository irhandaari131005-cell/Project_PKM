import { request } from "./api.js";

const env = import.meta.env ?? {};
const TEACHERS_ENDPOINT = env.VITE_DATA_GURU_ENDPOINT || "/api/data_guru";

export const TEACHER_FIELDS = Object.freeze({
  nama: "nama", nip: "nip", mata_pelajaran: "mata_pelajaran", sn: "sn",
});

function validationError(errors) {
  const error = new Error("Periksa kembali data guru.");
  error.response = { status: 422, data: { errors } };
  return error;
}

export function buildTeacherSearchParams({ search = "", page = 1 } = {}) {
  if (typeof search !== "string" || !Number.isSafeInteger(page) || page < 1) {
    throw validationError({ search: ["Pencarian atau halaman tidak valid."] });
  }
  return { page, ...(search.trim() ? { search: search.trim() } : {}) };
}

export function buildTeacherPayload(values = {}) {
  const errors = {};
  for (const [field, label] of [["nama", "Nama guru"], ["nip", "NIP"], ["mata_pelajaran", "Mata pelajaran"]]) {
    if (typeof values?.[field] !== "string" || !values[field].trim()) errors[TEACHER_FIELDS[field]] = [`${label} wajib diisi.`];
  }
  if (values?.sn != null && typeof values.sn !== "string") errors[TEACHER_FIELDS.sn] = ["Nomor kartu harus berupa string."];
  if (Object.keys(errors).length) throw validationError(errors);
  const payload = Object.fromEntries(["nama", "nip", "mata_pelajaran"].map((field) => [TEACHER_FIELDS[field], values[field].trim()]));
  if (values.sn?.trim()) payload[TEACHER_FIELDS.sn] = values.sn.trim();
  return { ...payload, status: "ACTIVE", type: "guru" };
}

export function assertTeacherResponse(payload) {
  let envelope = payload;
  for (let depth = 0; depth < 5 && envelope && typeof envelope === "object" && !Array.isArray(envelope); depth++) {
    const status = Number(envelope.status);
    if ((status >= 400 && status <= 599) || envelope.status === false || envelope.success === false) {
      const error = new Error("Permintaan data guru belum berhasil.");
      error.response = { status: status >= 400 && status <= 599 ? status : 422, data: envelope };
      throw error;
    }
    envelope = envelope.data_guru ?? envelope.data;
  }
  return payload;
}

export function normalizeCreatedTeacher(payload) {
  assertTeacherResponse(payload);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Respons penambahan guru belum sesuai.");
  const record = payload.data ?? payload;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Data guru pada respons belum sesuai.");
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (record.id_guru == null && record.id == null && !message && Number(payload.status) !== 201 && payload.success !== true) {
    throw new Error("Respons belum mengonfirmasi penyimpanan guru.");
  }
  return { payload, record, message: message || "Data guru berhasil ditambahkan." };
}

export const TEACHER_STATUSES = Object.freeze([
  Object.freeze({ value: "ACTIVE", label: "Aktif" }),
  Object.freeze({ value: "INACTIVE", label: "Nonaktif" }),
]);

/** Payload ubah guru. SN kosong dikirim null (hapus kartu); backend menolak bila guru sudah berakun. */
export function buildTeacherUpdatePayload(values = {}) {
  const errors = {};
  for (const [field, label] of [["nama", "Nama guru"], ["nip", "NIP"], ["mata_pelajaran", "Mata pelajaran"]]) {
    if (typeof values?.[field] !== "string" || !values[field].trim()) errors[TEACHER_FIELDS[field]] = [`${label} wajib diisi.`];
  }
  if (values?.sn != null && typeof values.sn !== "string") errors[TEACHER_FIELDS.sn] = ["Nomor kartu harus berupa string."];
  if (!TEACHER_STATUSES.some(({ value }) => value === values?.status)) errors.status = ["Pilih status Aktif atau Nonaktif."];
  if (Object.keys(errors).length) throw validationError(errors);
  return {
    nama: values.nama.trim(),
    nip: values.nip.trim(),
    mata_pelajaran: values.mata_pelajaran.trim(),
    sn: values.sn?.trim() || null,
    status: values.status,
  };
}

// ID guru = UUID akun (atau ID angka lama), sama seperti `id_guru` pada respons daftar.
function teacherPath(id) {
  const value = typeof id === "number" ? String(id) : id;
  if (typeof value !== "string"
    || !/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[1-9][0-9]*)$/i.test(value.trim())) {
    throw validationError({ id_guru: ["ID guru tidak valid."] });
  }
  return `${TEACHERS_ENDPOINT.replace(/\/+$/, "")}/${encodeURIComponent(value.trim())}`;
}

export const teachersApi = {
  async list(filters, { signal } = {}) {
    const payload = await request(TEACHERS_ENDPOINT, { method: "get", params: buildTeacherSearchParams(filters), signal });
    return assertTeacherResponse(payload);
  },
  async create(values, { signal } = {}) {
    const payload = await request(TEACHERS_ENDPOINT, { method: "post", data: buildTeacherPayload(values), signal });
    return normalizeCreatedTeacher(payload);
  },
  async update(id, values, { signal } = {}) {
    const payload = await request(teacherPath(id), { method: "put", data: buildTeacherUpdatePayload(values), signal });
    assertTeacherResponse(payload);
    const record = payload?.data;
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Respons perubahan guru belum sesuai.");
    return { payload, record, message: typeof payload.message === "string" && payload.message.trim() ? payload.message.trim() : "Data guru berhasil diperbarui." };
  },
  async remove(id, { signal } = {}) {
    const payload = await request(teacherPath(id), { method: "delete", signal });
    assertTeacherResponse(payload);
    return { payload, message: typeof payload?.message === "string" && payload.message.trim() ? payload.message.trim() : "Data guru berhasil dihapus." };
  },
};

const TEACHER_ACTIONS = {
  load: ["Data guru belum dapat dimuat. Silakan coba lagi.", "Anda tidak memiliki akses ke data guru."],
  save: ["Data guru belum dapat disimpan. Silakan coba lagi.", "Anda tidak memiliki izin menambah guru."],
  update: ["Perubahan data guru belum dapat disimpan. Silakan coba lagi.", "Anda tidak memiliki izin mengubah data guru."],
  delete: ["Data guru belum dapat dihapus. Silakan coba lagi.", "Anda tidak memiliki izin menghapus data guru."],
};

export function getTeacherError(error, action = "load") {
  const status = error.response?.status ?? error.status;
  const fields = {};
  if (status === 422) {
    for (const [field, key] of [...Object.entries(TEACHER_FIELDS), ["status", "status"], ["search", "search"]]) {
      const value = error.response?.data?.errors?.[key];
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") fields[field] = message;
    }
  }
  const [fallback, forbidden] = TEACHER_ACTIONS[action] ?? TEACHER_ACTIONS.load;
  const serverMessage = typeof error.response?.data?.message === "string" ? error.response.data.message.trim() : "";
  let message = fallback;
  if (status === 401) message = "Sesi berakhir. Silakan login kembali.";
  else if (status === 403) message = forbidden;
  else if (status === 404 && action !== "load") message = "Data guru tidak ditemukan. Muat ulang daftar guru.";
  // Mis. "Anda tidak dapat menghapus data guru milik akun Anda sendiri."
  else if (status === 409) message = serverMessage || "NIP atau nomor kartu sudah digunakan. Periksa kembali data guru.";
  else if (status === 422) message = "Periksa kembali data yang diisi.";
  else if (status === 429) message = "Terlalu banyak permintaan. Silakan tunggu sebentar.";
  else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") message = "Server belum merespons. Silakan periksa data sebelum mencoba lagi.";
  else if (error.code === "ERR_NETWORK") message = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return { message, fields };
}

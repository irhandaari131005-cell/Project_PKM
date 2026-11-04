import { request } from "./api.js";

const env = import.meta.env ?? {};
const ATTENDANCE_ENDPOINT = env.VITE_ATTENDANCE_ENDPOINT || "/api/absensi";

export const ATTENDANCE_FIELDS = Object.freeze({ sn: "sn", jenis_absensi: "jenis_absensi" });
export const ATTENDANCE_TYPES = Object.freeze([
  Object.freeze({ value: "masuk", label: "Absen masuk" }),
  Object.freeze({ value: "pulang", label: "Absen pulang" }),
]);

function validationError(field, message) {
  const error = new Error(message);
  error.response = { status: 422, data: { errors: { [ATTENDANCE_FIELDS[field]]: [message] } } };
  return error;
}

export function buildAttendancePayload({ sn, jenis_absensi }) {
  if (typeof sn !== "string" || !sn.trim()) {
    throw validationError("sn", "Nomor kartu wajib diisi.");
  }
  if (!ATTENDANCE_TYPES.some(({ value }) => value === jenis_absensi)) {
    throw validationError("jenis_absensi", "Pilih absen masuk atau absen pulang.");
  }
  return {
    [ATTENDANCE_FIELDS.sn]: sn.trim(),
    [ATTENDANCE_FIELDS.jenis_absensi]: jenis_absensi,
  };
}

export function normalizeAttendanceResponse(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Format respons absensi belum sesuai.");
  }
  const status = Number(payload.status);
  if ((status >= 400 && status <= 599) || payload.status === false || payload.success === false) {
    const error = new Error("Absensi belum berhasil.");
    error.response = { status: status >= 400 && status <= 599 ? status : 422, data: payload };
    throw error;
  }
  const record = payload.data ?? payload;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("Format data absensi belum sesuai.");
  }
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message && record.id_absensi == null && record.id == null && status !== 200 && status !== 201 && payload.success !== true) {
    throw new Error("Respons belum mengonfirmasi penyimpanan absensi.");
  }
  return { payload, record, message: message || "Presensi berhasil disimpan." };
}

export const attendanceApi = {
  async submit(values, { signal } = {}) {
    const payload = await request(ATTENDANCE_ENDPOINT, {
      method: "post",
      data: buildAttendancePayload(values),
      signal,
    });
    return normalizeAttendanceResponse(payload);
  },
};

export function getAttendanceError(error) {
  const status = error.response?.status;
  const fields = {};
  if (status === 422) {
    for (const [field, key] of Object.entries(ATTENDANCE_FIELDS)) {
      const value = error.response?.data?.errors?.[key];
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") fields[field] = message;
    }
  }
  // Untuk kartu/absensi, pesan server paling jelas (mis. "Andi sudah absen pulang hari ini.").
  const serverMessage = typeof error.response?.data?.message === "string" ? error.response.data.message.trim() : "";
  let message = "Absensi belum dapat disimpan. Silakan coba lagi.";
  if (status === 401) message = "Sesi berakhir. Silakan login kembali.";
  else if (status === 403) message = "Anda tidak memiliki izin untuk melakukan absensi.";
  else if (status === 404) message = serverMessage || "Data presensi atau kartu tidak ditemukan.";
  else if (status === 409) message = serverMessage || "Absensi ini sudah tercatat. Tidak perlu mengirim ulang.";
  else if (status === 422) message = fields.sn || fields.jenis_absensi || "Periksa kembali data absensi Anda.";
  else if (status === 429) message = "Terlalu banyak percobaan. Silakan tunggu sebentar.";
  else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    message = "Server belum merespons. Periksa catatan absensi sebelum mencoba lagi.";
  } else if (error.code === "ERR_NETWORK") {
    message = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  }
  return { message, fields };
}

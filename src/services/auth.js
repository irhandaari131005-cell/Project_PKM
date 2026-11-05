import { request } from "./api.js";

const env = import.meta.env ?? {};
const LOGIN_ENDPOINT = env.VITE_LOGIN_ENDPOINT || "/api/login";
const REGISTER_ENDPOINT = env.VITE_REGISTER_ENDPOINT || "/api/register";
const REGISTER_CLASSES_ENDPOINT = env.VITE_REGISTER_CLASSES_ENDPOINT || "/api/data_kelas";
const SESSION_ENDPOINT = env.VITE_SESSION_ENDPOINT || "/api/me";
const LOGOUT_ENDPOINT = env.VITE_LOGOUT_ENDPOINT || "/api/logout";
const CHANGE_PASSWORD_ENDPOINT = env.VITE_CHANGE_PASSWORD_ENDPOINT || "/api/change_password";
const USER_STORAGE_KEY = "auth_user";

// Kontrak awal login: sesuaikan key dan nilai role ini dengan controller backend.
export const LOGIN_FIELDS = Object.freeze({
  username: "username",
  password: "password",
  type: "type",
});

export const REGISTER_FIELDS = Object.freeze({
  nama: "nama",
  username: "username",
  sn: "sn",
  id_kelas: "id_kelas",
  type: "type",
  password: "password",
  password_confirmation: "password_confirmation",
});

export const LOGIN_ROLES = Object.freeze([
  Object.freeze({ value: "guru", label: "Guru" }),
  Object.freeze({ value: "siswa", label: "Siswa" }),
]);

// Auth::Register pada backend hanya menerima siswa dan guru.
export const REGISTER_ROLES = Object.freeze(
  LOGIN_ROLES.filter((role) => role.value === "guru" || role.value === "siswa"),
);

function authValidationError(field, message, fields = LOGIN_FIELDS) {
  const error = new Error(message);
  error.status = 422;
  error.response = { status: 422, data: { errors: { [fields[field]]: [message] } } };
  return error;
}

function buildCredentialsPayload({ username, password, type }, fields, roles = LOGIN_ROLES) {
  if (typeof username !== "string" || !username.trim()) {
    throw authValidationError("username", "Username wajib diisi.", fields);
  }
  if (typeof password !== "string" || !password) {
    throw authValidationError("password", "Password wajib diisi.", fields);
  }
  if (!roles.some((role) => role.value === type)) {
    throw authValidationError("type", "Pilih jenis akun yang tersedia.", fields);
  }
  return {
    [fields.username]: username.trim(),
    [fields.password]: password,
    [fields.type]: type,
  };
}

export function buildLoginPayload(credentials) {
  return buildCredentialsPayload(credentials, LOGIN_FIELDS);
}

export function buildRegisterPayload({ nama, username, sn, type, id_kelas, password, password_confirmation }) {
  if (typeof nama !== "string" || !nama.trim()) {
    throw authValidationError("nama", "Nama lengkap wajib diisi.", REGISTER_FIELDS);
  }
  const credentials = buildCredentialsPayload({ username, type, password }, REGISTER_FIELDS, REGISTER_ROLES);
  if (typeof sn !== "string" || !sn.trim()) {
    throw authValidationError("sn", "SN wajib diisi.", REGISTER_FIELDS);
  }
  if (password.length < 8) {
    throw authValidationError("password", "Password minimal 8 karakter.", REGISTER_FIELDS);
  }
  if (password_confirmation !== password) {
    throw authValidationError("password_confirmation", "Konfirmasi password tidak cocok.", REGISTER_FIELDS);
  }
  if (type === "siswa" && (typeof id_kelas !== "string"
    || !/^[1-9][0-9]*$/.test(id_kelas.trim()) || Number(id_kelas.trim()) > 2147483647)) {
    throw authValidationError("id_kelas", "Pilih kelas yang tersedia.", REGISTER_FIELDS);
  }
  return {
    [REGISTER_FIELDS.nama]: nama.trim(),
    ...credentials,
    [REGISTER_FIELDS.sn]: sn.trim(),
    ...(type === "siswa" ? { [REGISTER_FIELDS.id_kelas]: id_kelas.trim() } : {}),
    [REGISTER_FIELDS.password_confirmation]: password_confirmation,
  };
}

export const authApi = {
  async getClasses({ signal } = {}) {
    const payload = await request(REGISTER_CLASSES_ENDPOINT, {
      method: "get", signal, headers: { Authorization: null },
    });
    assertAuthResponse(payload, "Daftar kelas belum dapat dimuat.");
    if (!Array.isArray(payload.data)) throw new Error("Format daftar kelas belum sesuai.");
    return payload.data.map((record) => {
      const id = typeof record?.id_kelas === "number" || typeof record?.id_kelas === "string"
        ? String(record.id_kelas).trim() : "";
      const name = typeof record?.nama_kelas === "string" ? record.nama_kelas.trim() : "";
      if (!/^[1-9][0-9]*$/.test(id) || Number(id) > 2147483647 || !name) {
        throw new Error("Data kelas harus memuat ID dan nama kelas yang valid.");
      }
      return { id, name };
    });
  },
  login(credentials, { signal } = {}) {
    return request(LOGIN_ENDPOINT, {
      method: "post",
      data: buildLoginPayload(credentials),
      signal,
      // Login menggunakan kredensial form, tanpa token sesi sebelumnya.
      headers: { Authorization: null },
    });
  },
  async register(values, { signal } = {}) {
    const payload = await request(REGISTER_ENDPOINT, {
      method: "post",
      data: buildRegisterPayload(values),
      signal,
      headers: { Authorization: null },
    });
    return normalizeRegisterResponse(payload);
  },
  async me({ signal } = {}) {
    const payload = await request(SESSION_ENDPOINT, {
      method: "get",
      signal,
    });
    return normalizeLoginResponse(payload);
  },
  async logout({ signal } = {}) {
    const payload = await request(LOGOUT_ENDPOINT, {
      method: "get",
      signal,
    });
    assertAuthResponse(payload, "Logout belum berhasil.");
    return payload;
  },
};

function assertAuthResponse(payload, message = "Login belum berhasil.") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Format respons autentikasi belum sesuai.");
  }
  const status = Number(payload.status);
  const failedStatus = typeof payload.status === "string"
    && ["error", "fail", "failed", "failure", "false", "unauthenticated"].includes(payload.status.toLowerCase());
  if (status >= 400 || payload.success === false || payload.status === false || failedStatus) {
    const error = new Error(message);
    error.status = status >= 400 && status <= 599 ? status : 401;
    error.response = { status: error.status, data: payload };
    throw error;
  }
}

export function normalizeRegisterResponse(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Format respons registrasi belum sesuai.");
  }
  const status = Number(payload.status);
  if ((status >= 400 && status <= 599) || payload.success === false || payload.status === false) {
    const error = new Error("Registrasi belum berhasil.");
    const errorStatus = status >= 400 && status <= 599 ? status : 422;
    error.status = errorStatus;
    error.response = { status: errorStatus, data: payload };
    throw error;
  }
  return payload;
}

export function normalizeLoginResponse(payload) {
  assertAuthResponse(payload);
  const status = Number(payload?.status);
  const data = payload?.data ?? payload;
  const token = data?.token ?? data?.access_token ?? payload?.token ?? payload?.access_token;
  const hasToken = typeof token === "string" && Boolean(token.trim());
  const user = data?.user ?? payload?.user ?? (hasToken ? null : data);
  if (user !== null && (typeof user !== "object" || Array.isArray(user))) {
    throw new Error("Format profil pada respons login belum sesuai.");
  }
  if (hasToken) return { token, user, payload };

  // CodeIgniter menyimpan autentikasi pada cookie HttpOnly, bukan token JSON.
  const userId = user?.id_user;
  const hasValidUserId = (Number.isInteger(userId) && userId > 0)
    || (typeof userId === "string"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId));
  if (status >= 200 && status < 300 && hasValidUserId) {
    return { token: null, user, payload };
  }
  throw new Error("Respons autentikasi belum memuat profil atau token sesi yang valid.");
}

function getValidationFields(error, fieldNames) {
  const status = error.response?.status ?? error.status;
  const fields = {};
  const validation = error.response?.data?.errors;
  if (status === 422 && validation && typeof validation === "object") {
    for (const [field, backendField] of Object.entries(fieldNames)) {
      const value = validation[backendField];
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") fields[field] = message;
    }
  }
  return fields;
}

export function getLoginError(error) {
  const status = error.response?.status ?? error.status;
  const fields = getValidationFields(error, LOGIN_FIELDS);
  let message = "Login belum berhasil. Silakan coba lagi.";
  if (status === 400 || status === 401 || status === 403) {
    message = "Username, password, atau jenis akun tidak sesuai.";
  } else if (status === 422) {
    message = "Periksa kembali data login Anda.";
  } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    message = "Server belum merespons. Silakan coba lagi.";
  } else if (error.code === "ERR_NETWORK") {
    message = "Tidak dapat terhubung ke server. Silakan coba lagi.";
  }
  return { message, fields };
}

export function getRegisterError(error) {
  const status = error.response?.status ?? error.status;
  const fields = getValidationFields(error, REGISTER_FIELDS);
  let message = "Registrasi belum berhasil. Silakan coba lagi.";
  if (status === 422) {
    message = "Periksa kembali data pendaftaran Anda.";
  } else if (status === 409) {
    message = "Username sudah digunakan. Silakan pilih username lain.";
  } else if (status === 401 || status === 403) {
    message = "Pendaftaran akun belum diizinkan. Silakan hubungi sekolah.";
  } else if (status === 429) {
    message = "Terlalu banyak percobaan. Silakan coba beberapa saat lagi.";
  } else if (status >= 500 && status <= 599) {
    message = "Server gagal memproses pendaftaran. Silakan coba lagi nanti.";
  } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    message = "Server belum merespons. Silakan coba lagi.";
  } else if (error.code === "ERR_NETWORK") {
    message = "Tidak dapat terhubung ke server. Silakan coba lagi.";
  }
  return { message, fields };
}

export function readAuthSession() {
  try {
    const storage = globalThis.localStorage;
    const token = storage?.getItem("auth_token");
    if (typeof token !== "string" || !token.trim()) return null;
    let user = null;
    try {
      user = JSON.parse(storage.getItem(USER_STORAGE_KEY) || "null");
    } catch {
      // Token tetap dapat dipakai jika cache profil belum tersedia.
    }
    if (!user || typeof user !== "object" || Array.isArray(user)) user = null;
    return { token, user };
  } catch {
    return null;
  }
}

export function saveAuthSession({ token, user }) {
  const storage = globalThis.localStorage;
  if (typeof token !== "string" || !token.trim()) {
    storage.removeItem("auth_token");
    storage.setItem(USER_STORAGE_KEY, JSON.stringify(user ?? null));
    return;
  }
  storage.setItem(USER_STORAGE_KEY, JSON.stringify(user ?? null));
  storage.setItem("auth_token", token);
}

export function clearAuthSession() {
  const storage = globalThis.localStorage;
  storage?.removeItem("auth_token");
  storage?.removeItem(USER_STORAGE_KEY);
}

// ---- Ganti password (PATCH /api/change_password) ------------------------------
// Backend memakai bcrypt: password dihitung per byte (UTF-8), 8–72 byte, tanpa karakter null.
function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function changePasswordError(field, message) {
  const error = new Error(message);
  error.status = 422;
  error.field = field;
  return error;
}

/** Validasi di browser sebelum dikirim; backend tetap memvalidasi ulang. */
export function buildChangePasswordPayload({ username, currentPassword, newPassword, confirmPassword }) {
  if (typeof username !== "string" || !username.trim()) {
    throw changePasswordError("username", "Sesi login tidak memuat username. Silakan login ulang.");
  }
  if (typeof currentPassword !== "string" || !currentPassword) {
    throw changePasswordError("currentPassword", "Password saat ini wajib diisi.");
  }
  if (typeof newPassword !== "string" || byteLength(newPassword) < 8) {
    throw changePasswordError("newPassword", "Password baru minimal 8 karakter.");
  }
  if (byteLength(newPassword) > 72 || newPassword.includes("\0")) {
    throw changePasswordError("newPassword", "Password baru terlalu panjang (maksimal 72 byte).");
  }
  if (newPassword === currentPassword) {
    throw changePasswordError("newPassword", "Password baru harus berbeda dari password saat ini.");
  }
  if (newPassword !== confirmPassword) {
    throw changePasswordError("confirmPassword", "Konfirmasi password tidak cocok.");
  }
  return { username: username.trim(), password: currentPassword, new_password: newPassword };
}

export async function changePassword(values, { signal } = {}) {
  const payload = await request(CHANGE_PASSWORD_ENDPOINT, {
    method: "patch",
    data: buildChangePasswordPayload(values),
    signal,
  });
  assertAuthResponse(payload, "Password belum berhasil diubah.");
  return payload;
}

export function getChangePasswordError(error) {
  if (error?.field) return { message: error.message, field: error.field };
  const status = error?.response?.status ?? error?.status;
  let message = "Password belum berhasil diubah. Silakan coba lagi.";
  if (status === 401) message = "Password saat ini salah.";
  else if (status === 404) message = "Akun tidak ditemukan. Silakan login ulang.";
  else if (status === 429) message = "Terlalu banyak percobaan gagal. Tunggu beberapa saat lalu coba lagi.";
  else if (status === 400) message = error.response?.data?.message || "Periksa kembali password yang diisi.";
  else if (["ECONNABORTED", "ETIMEDOUT"].includes(error?.code)) message = "Server belum merespons. Silakan coba lagi.";
  else if (error?.code === "ERR_NETWORK") message = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return { message, field: status === 401 ? "currentPassword" : null };
}

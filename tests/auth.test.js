import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildLoginPayload, buildRegisterPayload, clearAuthSession, getLoginError, getRegisterError, LOGIN_ROLES, REGISTER_ROLES,
  normalizeLoginResponse, normalizeRegisterResponse, readAuthSession, saveAuthSession,
} from "../src/services/auth.js";

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});

function useStorage(values = {}) {
  const items = new Map(Object.entries(values));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => items.set(key, value),
      removeItem: (key) => items.delete(key),
    },
  });
  return items;
}

test("payload login hanya memuat username, password, dan jenis akun; password tetap utuh", () => {
  for (const role of LOGIN_ROLES) {
    assert.deepEqual(buildLoginPayload({ username: " 00123 ", password: " secret ", type: role.value, id_guru: "1" }), {
      username: "00123", password: " secret ", type: role.value,
    });
  }
});

test("input kosong dan jenis akun yang tidak dikenal menghasilkan validasi field", () => {
  for (const [field, value] of [["username", "   "], ["password", ""], ["type", "admin"]]) {
    try {
      buildLoginPayload({ username: "guru", password: "secret", type: "guru", [field]: value });
      assert.fail("Input tidak valid seharusnya ditolak");
    } catch (error) {
      assert.equal(error.status, 422);
      assert.ok(getLoginError(error).fields[field]);
    }
  }
});

test("respons login menerima token dan profil backend tanpa mengubah fieldnya", () => {
  const user = { id_guru: "1", nama: "Budi", sn: "00123", type: "guru", update_date: null };
  for (const payload of [
    { token: "test-token", user },
    { access_token: "test-token", user },
    { status: 200, message: "Login berhasil", data: { token: "test-token", user } },
  ]) {
    const session = normalizeLoginResponse(payload);
    assert.equal(session.token, "test-token");
    assert.deepEqual(session.user, user);
    assert.equal(session.payload, payload);
  }
});

test("login dan pemeriksaan sesi CodeIgniter memakai profil data tanpa token buatan", () => {
  const user = { id_user: 1, username: "budi", nama: "Budi", type: "guru" };
  for (const payload of [
    { status: 200, message: "Login berhasil", redirect: "/dashboard", data: user },
    { status: 200, message: "User terautentikasi", data: user },
  ]) {
    assert.deepEqual(normalizeLoginResponse(payload), { token: null, user, payload });
  }
});

test("respons gagal, token kosong, dan profil yang salah tidak menjadi sesi login", () => {
  for (const payload of [
    null, {}, [], "<html></html>", { data: { token: " " } }, { token: "test-token", user: [] },
    { status: 200 }, { status: 200, data: [] }, { status: 200, data: {} },
    { status: 200, data: { id_user: 0 } }, { data: { id_user: 1 } },
  ]) {
    assert.throws(() => normalizeLoginResponse(payload));
  }
  assert.throws(() => normalizeLoginResponse({ status: 401, data: { token: "test-token" } }),
    (error) => error.response.status === 401);
  assert.equal(normalizeLoginResponse({ token: "test-token" }).user, null);
});

test("status gagal dalam JSON tidak dapat masuk meskipun respons memuat token atau profil", () => {
  for (const failure of [{ status: 400 }, { status: 401 }, { status: false }, { success: false }, { status: "failed" }]) {
    assert.throws(() => normalizeLoginResponse({
      ...failure, token: "test-token", data: { id_user: 1, username: "budi" },
    }), (error) => error.response.status >= 400);
  }
});

test("validasi HTTP 422 dapat ditampilkan di field login yang sesuai", () => {
  const result = getLoginError({ response: { status: 422, data: { errors: {
    username: ["Username tidak ditemukan."], password: "Password wajib diisi.", type: ["Jenis akun tidak sesuai."],
  } } } });
  assert.deepEqual(result.fields, {
    username: "Username tidak ditemukan.", password: "Password wajib diisi.", type: "Jenis akun tidak sesuai.",
  });
});

test("pesan login membedakan kredensial, koneksi, dan timeout", () => {
  assert.match(getLoginError({ response: { status: 400 } }).message, /tidak sesuai/);
  assert.match(getLoginError({ response: { status: 401 } }).message, /tidak sesuai/);
  assert.match(getLoginError({ response: { status: 403 } }).message, /tidak sesuai/);
  assert.match(getLoginError({ code: "ERR_NETWORK" }).message, /terhubung/);
  assert.match(getLoginError({ code: "ECONNABORTED" }).message, /belum merespons/);
});

test("sesi menyimpan token dan profil; payload respons lain tidak ikut disimpan", () => {
  const storage = useStorage();
  const user = { id_siswa: "1", nama_siswa: "Andi", sn: "001", type: "siswa" };
  saveAuthSession({ token: "test-token", user, payload: { extra: "tidak disimpan" } });
  assert.deepEqual(readAuthSession(), { token: "test-token", user });
  assert.deepEqual([...storage.keys()].sort(), ["auth_token", "auth_user"]);
  clearAuthSession();
  assert.equal(readAuthSession(), null);
  assert.equal(storage.size, 0);
});

test("cache profil yang rusak tidak menggagalkan pembacaan token", () => {
  useStorage({ auth_token: "test-token", auth_user: "JSON rusak" });
  assert.deepEqual(readAuthSession(), { token: "test-token", user: null });
  useStorage({ auth_user: JSON.stringify({ nama: "Tanpa token" }) });
  assert.equal(readAuthSession(), null);
});

test("sesi cookie menghapus token lama dan cache profil tidak dianggap sebagai autentikasi", () => {
  const storage = useStorage({ auth_token: "expired-token", auth_user: JSON.stringify({ nama: "User lama" }) });
  const user = { id_user: 1, username: "budi", nama: "Budi", type: "guru" };
  saveAuthSession({ token: null, user, payload: { password: "tidak disimpan", redirect: "/dashboard" } });
  assert.deepEqual([...storage.keys()], ["auth_user"]);
  assert.deepEqual(JSON.parse(storage.get("auth_user")), user);
  assert.equal(readAuthSession(), null);
  clearAuthSession();
  assert.equal(storage.size, 0);
});

test("payload registrasi memakai field yang disepakati dan tidak mengirim field tambahan", () => {
  for (const role of REGISTER_ROLES) {
    assert.deepEqual(buildRegisterPayload({
      nama: " Budi Santoso ", username: " 00123 ", sn: " 000123 ", type: role.value,
      id_kelas: "1",
      password: " secret123 ", password_confirmation: " secret123 ", is_admin: true,
    }), {
      nama: "Budi Santoso", username: "00123", sn: "000123", type: role.value,
      ...(role.value === "siswa" ? { id_kelas: "1" } : {}),
      password: " secret123 ", password_confirmation: " secret123 ",
    });
  }
});

test("registrasi menolak data kosong, password pendek, konfirmasi berbeda, dan jenis akun tidak dikenal", () => {
  const values = { nama: "Budi", username: "guru", sn: "000123", type: "guru", password: "secret123", password_confirmation: "secret123" };
  for (const [field, value] of [
    ["nama", " "], ["username", " "], ["sn", ""], ["sn", " "], ["sn", undefined],
    ["sn", null], ["sn", 123], ["sn", {}], ["sn", ["000123"]], ["type", "admin"], ["type", "wali_murid"],
    ["password", ""], ["password", "short"], ["password_confirmation", "berbeda"],
  ]) {
    assert.throws(() => buildRegisterPayload({ ...values, [field]: value }), (error) => {
      assert.equal(error.status, 422);
      assert.ok(getRegisterError(error).fields[field]);
      return true;
    });
  }
});

test("registrasi hanya menawarkan jenis akun yang diterima backend CodeIgniter", () => {
  assert.deepEqual(REGISTER_ROLES.map((role) => role.value).sort(), ["guru", "siswa"]);
  assert.deepEqual(LOGIN_ROLES.map((role) => role.value).sort(), ["guru", "siswa"]);
});

test("respons registrasi berhasil tidak memerlukan token dan tidak membuat sesi", () => {
  const storage = useStorage();
  for (const payload of [
    { status: 201, message: "Registrasi berhasil", redirect: "/login" },
    { status: 201, message: "Registrasi berhasil", data: { user: { nama: "Budi" } } },
    { message: "Registrasi berhasil" },
  ]) {
    assert.equal(normalizeRegisterResponse(payload), payload);
    assert.equal(readAuthSession(), null);
    assert.equal(storage.size, 0);
  }
});

test("registrasi menolak respons tidak valid dan error di pembungkus JSON", () => {
  for (const payload of [null, "", [], "<html></html>"]) {
    assert.throws(() => normalizeRegisterResponse(payload));
  }
  for (const payload of [{ status: 422 }, { success: false }, { status: false }]) {
    assert.throws(() => normalizeRegisterResponse(payload), (error) => error.response.status === 422);
  }
});

test("error registrasi memetakan validasi Laravel ke seluruh field", () => {
  const fields = {
    nama: "Nama wajib diisi.", username: "Username sudah digunakan.", sn: "SN sudah digunakan.", type: "Jenis akun tidak sesuai.",
    id_kelas: "Kelas wajib dipilih.",
    password: "Password minimal 8 karakter.", password_confirmation: "Konfirmasi tidak cocok.",
  };
  const errors = Object.fromEntries(Object.entries(fields).map(([key, message]) => [key, [message]]));
  assert.deepEqual(getRegisterError({ response: { status: 422, data: { errors } } }).fields, fields);
});

test("pesan registrasi membedakan konflik username, izin, batas percobaan, koneksi, dan timeout", () => {
  assert.match(getRegisterError({ response: { status: 409 } }).message, /Username sudah digunakan/);
  assert.match(getRegisterError({ response: { status: 403 } }).message, /belum diizinkan/);
  assert.match(getRegisterError({ response: { status: 429 } }).message, /Terlalu banyak/);
  assert.match(getRegisterError({ response: { status: 500 } }).message, /Server gagal memproses pendaftaran/);
  assert.match(getRegisterError({ code: "ERR_NETWORK" }).message, /terhubung/);
  assert.match(getRegisterError({ code: "ECONNABORTED" }).message, /belum merespons/);
});

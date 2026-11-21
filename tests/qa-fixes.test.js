import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { apiClient } from "../src/services/api.js";
import {
  buildForgotPasswordPayload, forgotPassword, getForgotPasswordError, getLoginError,
} from "../src/services/auth.js";
import { classesApi, getClassError } from "../src/services/classes.js";
import { schedulesApi } from "../src/services/schedules.js";
import { extracurricularApi } from "../src/services/extracurricular.js";
import { getActivityError } from "../src/services/activityApi.js";

const originalBaseURL = apiClient.defaults.baseURL, originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let received, status, payload;

const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    received.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
    res.setHeader("Content-Type", "application/json");
    res.statusCode = status;
    res.end(JSON.stringify(payload ?? { status, message: "OK" }));
  });
});
before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}`;
  apiClient.defaults.proxy = false;
});
beforeEach(() => {
  received = []; status = 200; payload = null;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "token-lama" } });
});
afterEach(() => { if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else delete globalThis.localStorage; });
after(async () => {
  apiClient.defaults.baseURL = originalBaseURL; apiClient.defaults.proxy = originalProxy;
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
});

const forgot = { username: " siswa01 ", sn: " 0012AB ", newPassword: "baru12345", confirmPassword: "baru12345" };

test("lupa password: payload memakai field backend dan SN tetap string", () => {
  assert.deepEqual(buildForgotPasswordPayload(forgot), { username: "siswa01", sn: "0012AB", new_password: "baru12345" });
  const field = (values) => {
    try { buildForgotPasswordPayload({ ...forgot, ...values }); return null; } catch (error) { return [error.field, error.message]; }
  };
  assert.equal(field({ username: " " })[0], "username");
  assert.equal(field({ sn: "" })[0], "sn");
  assert.match(field({ newPassword: "pendek", confirmPassword: "pendek" })[1], /minimal 8/);
  assert.match(field({ newPassword: "€".repeat(25), confirmPassword: "€".repeat(25) })[1], /72 byte/);
  assert.equal(field({ confirmPassword: "lain12345" })[0], "confirmPassword");
});

test("lupa password: PATCH JSON ke /api/forgot_password tanpa token sesi", async () => {
  payload = { status: 200, message: "Password berhasil diubah." };
  await forgotPassword(forgot);
  assert.equal(received[0].method, "PATCH");
  assert.equal(received[0].url, "/api/forgot_password");
  assert.equal(received[0].headers.authorization, undefined);
  assert.deepEqual(JSON.parse(received[0].body), { username: "siswa01", sn: "0012AB", new_password: "baru12345" });
});

test("lupa password: error server dipetakan ke pesan yang jelas", async () => {
  status = 401; payload = { status: 401, message: "Username atau SN tidak sesuai." };
  await assert.rejects(forgotPassword(forgot), (error) => {
    assert.deepEqual(getForgotPasswordError(error), { message: "Username atau nomor kartu (SN) tidak sesuai.", field: "sn" });
    return true;
  });
  assert.match(getForgotPasswordError({ response: { status: 429 } }).message, /Terlalu banyak/);
  assert.match(getForgotPasswordError({ response: { status: 400, data: { message: "SN harus diisi." } } }).message, /SN harus diisi/);
  assert.match(getForgotPasswordError({ code: "ERR_NETWORK" }).message, /terhubung/);
});

test("login: 429 dan 403 punya pesan yang bisa ditindaklanjuti", () => {
  assert.match(getLoginError({ response: { status: 429 } }).message, /Terlalu banyak percobaan/);
  assert.match(getLoginError({ response: { status: 403 } }).message, /Jenis akun tidak sesuai/);
  assert.match(getLoginError({ response: { status: 500 } }).message, /Server/);
});

test("kelas: hapus memakai DELETE dan 409 menampilkan pesan server", async () => {
  payload = { status: 200, message: "Data kelas berhasil dihapus." };
  const result = await classesApi.remove("7");
  assert.equal(result.message, "Data kelas berhasil dihapus.");
  assert.equal(received[0].method, "DELETE");
  assert.equal(received[0].url, "/api/kelas/7");

  status = 409; payload = { status: 409, message: "Kelas masih memiliki siswa. Pindahkan siswa terlebih dahulu." };
  await assert.rejects(classesApi.remove("7"), (error) => {
    assert.equal(getClassError(error, "delete").message, "Kelas masih memiliki siswa. Pindahkan siswa terlebih dahulu.");
    return true;
  });
  // Konflik saat simpan: pesan + field dari server tampil di bawah input.
  const conflict = getClassError({ response: { status: 409, data: { message: "Nama kelas sudah dipakai.", errors: { nama_kelas: "Nama kelas sudah dipakai." } } } }, "save");
  assert.deepEqual(conflict, { message: "Nama kelas sudah dipakai.", fields: { nama_kelas: "Nama kelas sudah dipakai." } });
  await assert.rejects(classesApi.remove(""), (error) => error.response.status === 422);
});

test("jadwal & ekskul: hapus memakai DELETE ke endpoint item", async () => {
  await schedulesApi.remove("12");
  await extracurricularApi.remove("3");
  assert.deepEqual(received.map(({ method, url }) => [method, url]), [["DELETE", "/api/jadwal/12"], ["DELETE", "/api/ekstrakurikuler/3"]]);
  status = 404; payload = { status: 404, message: "Jadwal tidak ditemukan." };
  await assert.rejects(schedulesApi.remove("12"), (error) => {
    assert.match(getActivityError(error, "delete").message, /tidak ditemukan/);
    return true;
  });
  assert.match(getActivityError({ response: { status: 500 } }, "delete").message, /dihapus/);
});

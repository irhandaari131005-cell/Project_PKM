import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { apiClient } from "../src/services/api.js";
import { buildChangePasswordPayload, changePassword, getChangePasswordError } from "../src/services/auth.js";

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
    res.end(JSON.stringify(payload ?? { status, message: "Password berhasil diubah." }));
  });
});
before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}`;
  apiClient.defaults.proxy = false;
});
beforeEach(() => {
  received = []; status = 200; payload = null;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
});
afterEach(() => { if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else delete globalThis.localStorage; });
after(async () => {
  apiClient.defaults.baseURL = originalBaseURL; apiClient.defaults.proxy = originalProxy;
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
});

const valid = { username: " guru ", currentPassword: "lama1234", newPassword: "baru12345", confirmPassword: "baru12345" };

test("payload memakai nama field backend dan username dari sesi", () => {
  assert.deepEqual(buildChangePasswordPayload(valid), { username: "guru", password: "lama1234", new_password: "baru12345" });
});

test("validasi password baru di browser", () => {
  const field = (values) => {
    try { buildChangePasswordPayload({ ...valid, ...values }); return null; } catch (error) { return [error.field, error.message]; }
  };
  assert.deepEqual(field({ username: "" }), ["username", "Sesi login tidak memuat username. Silakan login ulang."]);
  assert.equal(field({ currentPassword: "" })[0], "currentPassword");
  assert.match(field({ newPassword: "pendek", confirmPassword: "pendek" })[1], /minimal 8/);
  // 25 karakter × 3 byte = 75 byte: lolos panjang karakter tapi melebihi batas bcrypt.
  assert.match(field({ newPassword: "€".repeat(25), confirmPassword: "€".repeat(25) })[1], /72 byte/);
  assert.match(field({ newPassword: "lama1234", confirmPassword: "lama1234" })[1], /berbeda/);
  assert.equal(field({ confirmPassword: "lain12345" })[0], "confirmPassword");
});

test("mengirim PATCH JSON ke /api/change_password", async () => {
  const result = await changePassword(valid);
  assert.equal(result.message, "Password berhasil diubah.");
  assert.equal(received[0].method, "PATCH");
  assert.equal(received[0].url, "/api/change_password");
  assert.match(received[0].headers["content-type"], /application\/json/);
  assert.deepEqual(JSON.parse(received[0].body), { username: "guru", password: "lama1234", new_password: "baru12345" });
});

test("validasi gagal tidak mengirim request", async () => {
  await assert.rejects(changePassword({ ...valid, confirmPassword: "beda" }));
  assert.equal(received.length, 0);
});

test("error backend diterjemahkan untuk pengguna", async () => {
  const cases = [
    [401, "Password saat ini salah.", "currentPassword"],
    [429, "Terlalu banyak percobaan gagal. Tunggu beberapa saat lalu coba lagi.", null],
    [404, "Akun tidak ditemukan. Silakan login ulang.", null],
    [500, "Password belum berhasil diubah. Silakan coba lagi.", null],
  ];
  for (const [code, message, field] of cases) {
    status = code; payload = { status: code, message: "dari server" };
    await assert.rejects(changePassword(valid), (error) => {
      assert.deepEqual(getChangePasswordError(error), { message, field });
      return true;
    });
  }
  status = 400; payload = { status: 400, message: "Password baru harus terdiri dari 8 sampai 72 byte." };
  await assert.rejects(changePassword(valid), (error) => {
    assert.equal(getChangePasswordError(error).message, "Password baru harus terdiri dari 8 sampai 72 byte.");
    return true;
  });
});

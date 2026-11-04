import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { authApi, buildRegisterPayload, getRegisterError } from "../src/services/auth.js";
import { apiClient } from "../src/services/api.js";

const originalAdapter = apiClient.defaults.adapter;
const student = { nama: "Budi", username: "budi", sn: "001234", type: "siswa", password: "Password123!", password_confirmation: "Password123!", id_kelas: " 2 " };

afterEach(() => { apiClient.defaults.adapter = originalAdapter; });

test("registrasi siswa mengirim kelas yang dipilih dan guru tidak mengirim kelas", () => {
  assert.equal(buildRegisterPayload(student).id_kelas, "2");
  assert.equal(buildRegisterPayload({ ...student, type: "guru" }).id_kelas, undefined);
});

test("kelas kosong dan identifier yang tidak valid menghentikan registrasi siswa", () => {
  for (const id_kelas of [undefined, null, "", " ", 1, true, [], {}, "0", "-1", "1.5", "x", "2147483648"]) {
    assert.throws(() => buildRegisterPayload({ ...student, id_kelas }), (error) => {
      assert.equal(error.status, 422);
      assert.ok(getRegisterError(error).fields.id_kelas);
      return true;
    });
  }
});

test("pilihan kelas berasal dari endpoint publik dan menerima ID MySQL maupun JSON numerik", async () => {
  const controller = new AbortController();
  apiClient.defaults.adapter = async (config) => {
    assert.equal(config.url, "/api/data_kelas");
    assert.equal(config.method, "get");
    assert.equal(config.signal, controller.signal);
    assert.equal(config.withCredentials, true);
    assert.equal(config.headers.get("Authorization"), null);
    return { config, status: 200, headers: {}, data: { status: 200, data: [
      { id_kelas: "1", nama_kelas: "X RPL 1" }, { id_kelas: 2, nama_kelas: "X RPL 2" },
    ] } };
  };
  assert.deepEqual(await authApi.getClasses({ signal: controller.signal }), [
    { id: "1", name: "X RPL 1" }, { id: "2", name: "X RPL 2" },
  ]);
});

test("daftar kelas kosong valid; data rusak dan respons gagal tidak menjadi pilihan kelas", async () => {
  let payload = { status: 200, data: [] };
  apiClient.defaults.adapter = async (config) => ({ config, status: 200, headers: {}, data: payload });
  assert.deepEqual(await authApi.getClasses(), []);
  for (const invalid of [
    { status: 500, data: [] }, { status: 200, data: {} },
    { status: 200, data: [{ id_kelas: "1" }] },
    { status: 200, data: [{ id_kelas: "invalid", nama_kelas: "X RPL" }] },
  ]) {
    payload = invalid;
    await assert.rejects(authApi.getClasses());
  }
});

test("POST registrasi menyimpan field kelas dan memetakan validasi backend ke field kelas", async () => {
  apiClient.defaults.adapter = async (config) => {
    assert.equal(config.url, "/api/register");
    assert.equal(config.method, "post");
    assert.equal(JSON.parse(config.data).id_kelas, "2");
    return { config, status: 201, headers: {}, data: { status: 201, message: "Registrasi berhasil", redirect: "/login" } };
  };
  assert.equal((await authApi.register(student)).status, 201);
  assert.equal(getRegisterError({ response: { status: 422, data: { errors: { id_kelas: "Kelas tidak ditemukan." } } } }).fields.id_kelas, "Kelas tidak ditemukan.");
});

import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { apiClient } from "../src/services/api.js";
import { buildStudentUpdatePayload, getStudentError, studentsApi } from "../src/services/students.js";
import { buildTeacherUpdatePayload, getTeacherError, teachersApi } from "../src/services/teachers.js";

const originalBaseURL = apiClient.defaults.baseURL, originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let received, status, payload;

const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    received.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
    res.setHeader("Content-Type", "application/json");
    res.statusCode = status;
    res.end(JSON.stringify(payload ?? { status, message: "OK", data: { id_siswa: "7", nama_siswa: "Andi" } }));
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

const student = { nama_siswa: " Andi ", nis: " 0012 ", id_kelas: " 3 ", sn: "  ", status: "INACTIVE" };
const teacher = { nama: " Bu Ani ", nip: " 1980.01 ", mata_pelajaran: " Matematika ", sn: " 00AB ", status: "ACTIVE" };
const UUID = "11111111-1111-4111-8111-111111111111";

test("ubah siswa: payload rapi, SN kosong menjadi null, status wajib valid", () => {
  assert.deepEqual(buildStudentUpdatePayload(student), { nama_siswa: "Andi", nis: "0012", id_kelas: "3", sn: null, status: "INACTIVE" });
  const fields = (values) => {
    try { buildStudentUpdatePayload({ ...student, ...values }); return []; } catch (error) { return Object.keys(getStudentError(error).fields); }
  };
  assert.deepEqual(fields({ nama_siswa: " " }), ["nama_siswa"]);
  assert.deepEqual(fields({ nis: "", id_kelas: "" }), ["nis", "id_kelas"]);
  assert.deepEqual(fields({ status: "LULUS" }), ["status"]);
  assert.deepEqual(fields({ sn: 5 }), ["sn"]);
});

test("ubah guru: payload rapi dan NIP/SN tetap string", () => {
  assert.deepEqual(buildTeacherUpdatePayload(teacher), { nama: "Bu Ani", nip: "1980.01", mata_pelajaran: "Matematika", sn: "00AB", status: "ACTIVE" });
  assert.throws(() => buildTeacherUpdatePayload({ ...teacher, mata_pelajaran: "" }), (error) => Boolean(getTeacherError(error).fields.mata_pelajaran));
  assert.throws(() => buildTeacherUpdatePayload({ ...teacher, status: undefined }), (error) => Boolean(getTeacherError(error).fields.status));
});

test("siswa: PUT dan DELETE ke /api/data_siswa/{id}", async () => {
  payload = { status: 200, message: "Data siswa berhasil diperbarui.", data: { id_siswa: "7", nama_siswa: "Andi" } };
  const updated = await studentsApi.update("7", student);
  assert.equal(updated.message, "Data siswa berhasil diperbarui.");
  assert.equal(updated.record.nama_siswa, "Andi");
  payload = { status: 200, message: "Data siswa beserta akun loginnya berhasil dihapus." };
  const removed = await studentsApi.remove(7);
  assert.equal(removed.message, "Data siswa beserta akun loginnya berhasil dihapus.");
  assert.deepEqual(received.map(({ method, url }) => [method, url]), [["PUT", "/api/data_siswa/7"], ["DELETE", "/api/data_siswa/7"]]);
  assert.deepEqual(received[0].body, { nama_siswa: "Andi", nis: "0012", id_kelas: "3", sn: null, status: "INACTIVE" });
  await assert.rejects(studentsApi.remove("../1"), (error) => error.response.status === 422);
  assert.equal(received.length, 2, "ID tidak valid tidak dikirim ke server");
});

test("guru: PUT dan DELETE ke /api/data_guru/{uuid}", async () => {
  payload = { status: 200, message: "Data guru berhasil diperbarui.", data: { id_guru: UUID, nama: "Bu Ani" } };
  await teachersApi.update(UUID, teacher);
  payload = { status: 200, message: "Data guru berhasil dihapus." };
  await teachersApi.remove(UUID);
  assert.deepEqual(received.map(({ method, url }) => [method, url]), [["PUT", `/api/data_guru/${UUID}`], ["DELETE", `/api/data_guru/${UUID}`]]);
  await assert.rejects(teachersApi.remove("bukan id"), (error) => error.response.status === 422);
});

test("error ubah/hapus: pesan server 409 ditampilkan, 403/404 sesuai aksi", async () => {
  status = 409; payload = { status: 409, message: "Siswa ini sudah memiliki riwayat absensi sehingga tidak dapat dihapus." };
  await assert.rejects(studentsApi.remove("7"), (error) => {
    assert.equal(getStudentError(error, "delete").message, "Siswa ini sudah memiliki riwayat absensi sehingga tidak dapat dihapus.");
    return true;
  });
  status = 409; payload = { status: 409, message: "Anda tidak dapat menghapus data guru milik akun Anda sendiri." };
  await assert.rejects(teachersApi.remove(UUID), (error) => {
    assert.match(getTeacherError(error, "delete").message, /akun Anda sendiri/);
    return true;
  });
  assert.match(getStudentError({ response: { status: 403 } }, "update").message, /izin mengubah/);
  assert.match(getStudentError({ response: { status: 403 } }, "delete").message, /izin menghapus/);
  assert.match(getTeacherError({ response: { status: 404 } }, "update").message, /tidak ditemukan/);
  assert.match(getStudentError({ response: { status: 422, data: { errors: { status: "Pilih status Aktif atau Nonaktif." } } } }, "update").fields.status, /Aktif/);
  // Respons ubah tanpa record bukan sukses.
  status = 200; payload = { status: 200, message: "OK" };
  await assert.rejects(studentsApi.update("7", student), /belum sesuai/);
});

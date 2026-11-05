import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { apiClient } from "../src/services/api.js";
import {
  buildProfilePayload,
  getProfileError,
  getProfileFormValues,
  profileApi,
  validateProfilePhoto,
} from "../src/services/profile.js";
import { formatBirth, getProfileView } from "../src/pages/DashboardPage/dashboardData.js";

const originalBaseURL = apiClient.defaults.baseURL, originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const PROFILE = {
  id_user: "11111111-1111-4111-8111-111111111111", username: "guru", type: "guru", nama: "Bu Ani", sn: "G-01",
  status: "ACTIVE", tempat_lahir: "Bandung", tanggal_lahir: "1990-02-28", alamat: "Jl. Merdeka 1",
  no_telp: "081234567890", foto_url: "/uploads/profil/" + "a".repeat(32) + ".jpg",
};
const jpeg = () => new File([Uint8Array.from([255, 216, 255, 217])], "saya.jpg", { type: "image/jpeg" });
let received, status, payload;

const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    received.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString("latin1") });
    res.setHeader("Content-Type", "application/json");
    res.statusCode = status;
    res.end(JSON.stringify(payload ?? { status, message: "OK", data: PROFILE }));
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

const valid = { nama: " Ani ", tempat_lahir: "Bandung", tanggal_lahir: "1990-02-28", alamat: "Jl. A", no_telp: "0812-3456 7890" };

test("payload profil di-trim, no telp dinormalisasi, dan tidak memuat SN/tipe/status", () => {
  assert.deepEqual(buildProfilePayload({ ...valid, sn: "X", type: "guru", status: "INACTIVE" }), {
    nama: "Ani", tempat_lahir: "Bandung", tanggal_lahir: "1990-02-28", alamat: "Jl. A", no_telp: "081234567890",
  });
});

test("validasi profil memakai nama field backend", () => {
  assert.throws(
    () => buildProfilePayload({ nama: "", tanggal_lahir: "1990-02-30", no_telp: "12ab", alamat: "x".repeat(256) }),
    (error) => {
      assert.equal(error.response.status, 422);
      assert.deepEqual(Object.keys(error.response.data.errors), ["nama", "tanggal_lahir", "alamat", "no_telp"]);
      return true;
    },
  );
  assert.throws(() => buildProfilePayload({ ...valid, tanggal_lahir: "2999-01-01" }), /Periksa kembali/);
  assert.equal(buildProfilePayload({ ...valid, tanggal_lahir: "", no_telp: "" }).no_telp, "");
});

test("foto profil hanya JPG/WebP maksimal 2 MB", () => {
  assert.equal(validateProfilePhoto(null), null);
  assert.equal(validateProfilePhoto(jpeg()), null);
  assert.match(validateProfilePhoto(new File(["x"], "a.png", { type: "image/png" })), /Format/);
  assert.match(validateProfilePhoto(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "a.jpg", { type: "image/jpeg" })), /2 MB/);
});

test("tampilan profil memakai field backend baru", () => {
  const view = getProfileView({ ...PROFILE, foto_url: "http://localhost:8080/uploads/profil/a.jpg" });
  assert.equal(view.birthDate, "Bandung, 28 Februari 1990");
  assert.equal(view.address, "Jl. Merdeka 1");
  assert.equal(view.phone, "081234567890");
  assert.equal(view.status, "Aktif");
  assert.equal(view.type, "guru");
  assert.equal(view.typeLabel, "Guru");
  assert.equal(view.photo, "http://localhost:8080/uploads/profil/a.jpg");
  assert.equal(formatBirth("", ""), undefined);
  assert.equal(formatBirth(null, "2001-01-05"), "5 Januari 2001");
});

test("nilai awal form diambil dari profil, null menjadi string kosong", () => {
  assert.deepEqual(getProfileFormValues({ ...PROFILE, alamat: null }), {
    nama: "Bu Ani", tempat_lahir: "Bandung", tanggal_lahir: "1990-02-28", alamat: "", no_telp: "081234567890",
    foto: null, hapus_foto: false,
  });
});

test("GET /api/profile mengembalikan profil dengan URL foto absolut", async () => {
  const profile = await profileApi.get();
  assert.equal(received[0].method, "GET");
  assert.equal(received[0].url, "/api/profile");
  assert.equal(profile.nama, "Bu Ani");
  assert.equal(profile.foto_url, `${apiClient.defaults.baseURL}/uploads/profil/${"a".repeat(32)}.jpg`);
});

test("update tanpa foto dikirim sebagai JSON PUT", async () => {
  await profileApi.update({ ...valid, foto: null, hapus_foto: false });
  assert.equal(received[0].method, "PUT");
  assert.match(received[0].headers["content-type"], /application\/json/);
  assert.deepEqual(JSON.parse(received[0].body), buildProfilePayload(valid));
});

test("update dengan foto dikirim multipart POST + _method=PUT", async () => {
  await profileApi.update({ ...valid, foto: jpeg(), hapus_foto: false });
  const { method, headers, body } = received[0];
  assert.equal(method, "POST");
  assert.match(headers["content-type"], /multipart\/form-data/);
  assert.match(body, /name="foto"; filename="saya.jpg"/);
  assert.match(body, /name="_method"\r\n\r\nPUT/);
  assert.match(body, /name="nama"\r\n\r\nAni/);
  assert.doesNotMatch(body, /hapus_foto/);
});

test("hapus foto dikirim multipart dengan hapus_foto=1", async () => {
  await profileApi.update({ ...valid, foto: null, hapus_foto: true });
  assert.equal(received[0].method, "POST");
  assert.match(received[0].body, /name="hapus_foto"\r\n\r\n1/);
});

test("error backend diterjemahkan untuk pengguna", async () => {
  status = 422;
  payload = { status: 422, message: "Validasi gagal.", errors: { no_telp: "No telp harus berisi 8–15 angka." } };
  await assert.rejects(profileApi.update({ ...valid }), (error) => {
    const result = getProfileError(error, "save");
    assert.equal(result.message, "Periksa kembali data yang diisi.");
    assert.deepEqual(result.fields, { no_telp: "No telp harus berisi 8–15 angka." });
    return true;
  });

  status = 409;
  payload = { status: 409, message: "Data siswa untuk akun ini belum terdaftar. Hubungi admin sekolah." };
  await assert.rejects(profileApi.get(), (error) => {
    assert.match(getProfileError(error).message, /belum terdaftar/);
    return true;
  });
});

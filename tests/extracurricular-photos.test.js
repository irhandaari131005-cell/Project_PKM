import test from "node:test";
import assert from "node:assert/strict";
import { apiClient } from "../src/services/api.js";
import { getActivityError } from "../src/services/activityApi.js";
import { getExtracurricularView } from "../src/services/extracurricular.js";
import { MAX_PHOTO_BYTES, normalizePhotos, prepareExtracurricularWrite, validatePhotoFiles } from "../src/services/extracurricularPhotos.js";

const photo = (name = "pramuka.jpg", type = "image/jpeg", size = 4) => new File([new Uint8Array(size)], name, { type });

test("validasi foto menerima JPEG/WebP dan menolak format, ukuran, serta jumlah yang salah", () => {
  assert.equal(validatePhotoFiles([photo(), photo("futsal.webp", "image/webp")]).length, 2);
  for (const files of [null, ["file.jpg"], [photo("file.png", "image/png")], [photo("file.gif", "image/gif")], [photo("file.svg", "image/svg+xml")], [photo("file.jpg", "image/png")], [photo("file.jpeg", "image/jpeg", 0)], [photo("large.jpg", "image/jpeg", MAX_PHOTO_BYTES + 1)], Array.from({ length: 6 }, () => photo())]) {
    assert.throws(() => validatePhotoFiles(files), (error) => Boolean(getActivityError(error).fields.foto));
  }
});

test("tambah foto membuat FormData dengan foto[] dan nilai field nullable kosong", () => {
  const file = photo();
  const result = prepareExtracurricularWrite({ nama_ekstrakurikuler: "Pramuka", id_pembina: null, status: "ACTIVE" }, { foto: [file] }, "post");
  assert.equal(result.method, "post"); assert.ok(result.data instanceof FormData);
  assert.equal(result.data.get("foto[]").name, file.name);
  assert.equal(result.data.get("id_pembina"), "");
  assert.equal(result.data.get("nama_ekstrakurikuler"), "Pramuka");
  assert.equal(result.data.has("_method"), false);
});

test("edit foto memakai POST multipart dengan _method PUT dan ID penghapusan string", () => {
  const result = prepareExtracurricularWrite({ nama_ekstrakurikuler: "Pramuka" }, { foto: [photo()], hapus_foto: ["001", " 001 ", "002"] }, "put");
  assert.equal(result.method, "post"); assert.equal(result.data.get("_method"), "PUT");
  assert.deepEqual(result.data.getAll("hapus_foto[]"), ["001", "002"]);
  const removedOnly = prepareExtracurricularWrite({}, { hapus_foto: ["001"] }, "put");
  assert.equal(removedOnly.data.get("_method"), "PUT"); assert.equal(removedOnly.data.has("foto[]"), false);
  for (const hapus_foto of [1, [1], [" "]]) assert.throws(() => prepareExtracurricularWrite({}, { hapus_foto }, "put"));
});

test("request tanpa perubahan foto tetap memakai JSON dan metode awal", () => {
  const payload = { nama_ekstrakurikuler: "Pramuka", id_pembina: null };
  for (const method of ["post", "put"]) {
    const result = prepareExtracurricularWrite(payload, { foto: [], hapus_foto: [] }, method);
    assert.equal(result.method, method); assert.equal(result.data, payload);
  }
});

test("URL foto relatif mengikuti backend dan protokol non HTTP ditolak", () => {
  const original = apiClient.defaults.baseURL;
  try {
    apiClient.defaults.baseURL = "https://school.example/api";
    const photos = normalizePhotos([{ id_foto: "001", url: "/storage/pramuka.webp", caption: "Pramuka" }, { url: "https://cdn.example/futsal.jpg" }, { url: "javascript:alert(1)" }, { url: "data:image/svg+xml,invalid" }, null]);
    assert.equal(photos.length, 2);
    assert.deepEqual(photos[0], { id: "001", url: "https://school.example/storage/pramuka.webp", caption: "Pramuka" });
    assert.equal(photos[1].url, "https://cdn.example/futsal.jpg");
    const view = getExtracurricularView({ id: "001", nama: "Pramuka", foto: [{ id: "002", foto_url: "/storage/satu.jpg" }] });
    assert.equal(view.photos[0].caption, "Pramuka"); assert.equal(view.photos[0].id, "002");
    assert.equal(getExtracurricularView({ foto_url: "/storage/satu.jpg" }).photos.length, 1);
  } finally { apiClient.defaults.baseURL = original; }
});

test("validasi Laravel per foto ditampilkan pada field unggah", () => {
  assert.equal(getActivityError({ response: { status: 422, data: { errors: { "foto.0": ["Foto terlalu besar."] } } } }).fields.foto, "Foto terlalu besar.");
  assert.equal(getActivityError({ response: { status: 422, data: { errors: { "hapus_foto.0": ["Foto bukan milik kegiatan ini."] } } } }).fields.foto, "Foto bukan milik kegiatan ini.");
  assert.match(getActivityError({ response: { status: 413 } }, "save").message, /Kecilkan foto/);
});

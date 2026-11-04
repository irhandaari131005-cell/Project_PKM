import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import axios from "axios";
import { apiClient } from "../src/services/api.js";
import { extracurricularApi } from "../src/services/extracurricular.js";

const originalBaseURL = apiClient.defaults.baseURL, originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const values = { nama_ekstrakurikuler: "Pramuka", id_pembina: "002", hari: "sabtu", jam_mulai: "08:00", jam_selesai: "10:00" };
const bytes = Uint8Array.from([255, 216, 255, 0, 1, 2, 255, 217]);
const file = () => new File([bytes], "pramuka.jpg", { type: "image/jpeg" });
let received, status, payload, hold, started;
function parseMultipart(body, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  assert.ok(boundary, "Axios must generate a multipart boundary");
  return body.toString("latin1").split(`--${boundary[1] || boundary[2]}`).flatMap((part) => {
    const separator = part.indexOf("\r\n\r\n"); if (separator < 0) return [];
    const headers = part.slice(0, separator), name = /name="([^"]+)"/.exec(headers)?.[1];
    return [{ name, filename: /filename="([^"]+)"/.exec(headers)?.[1], bytes: Buffer.from(part.slice(separator + 4, -2), "latin1") }];
  });
}
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost"), item = { method: req.method, url, headers: req.headers };
  received.push(item); res.setHeader("Content-Type", "application/json");
  if (req.method === "GET") {
    res.statusCode = status; res.end(JSON.stringify(payload ?? { data: [{ id_foto: "001", url: "/storage/pramuka.jpg", caption: "Pramuka" }] })); return;
  }
  const chunks = []; req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    item.parts = parseMultipart(Buffer.concat(chunks), req.headers["content-type"]);
    started?.(); if (hold) return;
    res.statusCode = status === 200 && url.pathname === "/api/ekstrakurikuler" ? 201 : status;
    res.end(JSON.stringify(payload ?? { data: { id_ekstrakurikuler: "001", ...values, foto: [{ id_foto: "001", url: "/storage/pramuka.jpg" }] } }));
  });
});
before(async () => { await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); apiClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}`; apiClient.defaults.proxy = false; });
beforeEach(() => { received = []; status = 200; payload = null; hold = false; started = undefined; Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "photos-token" } }); });
afterEach(() => { if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else delete globalThis.localStorage; });
after(async () => { apiClient.defaults.baseURL = originalBaseURL; apiClient.defaults.proxy = originalProxy; server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });

test("POST foto mengirim multipart asli beserta binary, field teks, dan Bearer token", async () => {
  const result = await extracurricularApi.create({ ...values, foto: [file()] });
  assert.equal(result.record.id_ekstrakurikuler, "001");
  const request = received[0]; assert.equal(request.method, "POST"); assert.equal(request.url.pathname, "/api/ekstrakurikuler"); assert.equal(request.headers.authorization, "Bearer photos-token");
  assert.match(request.headers["content-type"], /^multipart\/form-data; boundary=/);
  const image = request.parts.find((part) => part.name === "foto[]");
  assert.equal(image.filename, "pramuka.jpg"); assert.deepEqual(image.bytes, Buffer.from(bytes));
  assert.equal(request.parts.find((part) => part.name === "id_pembina").bytes.toString(), "002");
  assert.ok(!request.parts.some((part) => part.name === "_method"));
});

test("edit foto kompatibel Laravel: POST multipart ke /{id}, _method PUT, dan hapus_foto[]", async () => {
  await extracurricularApi.update("001", { ...values, foto: [file()], hapus_foto: ["0002"] });
  assert.equal(received[0].method, "POST"); assert.equal(received[0].url.pathname, "/api/ekstrakurikuler/001");
  assert.equal(received[0].parts.find((part) => part.name === "_method").bytes.toString(), "PUT");
  assert.equal(received[0].parts.find((part) => part.name === "hapus_foto[]").bytes.toString(), "0002");
});

test("galeri GET mandiri meminta maksimal lima foto dan tidak memakai filter daftar", async () => {
  const photos = await extracurricularApi.getPhotos();
  assert.equal(received[0].url.pathname, "/api/ekstrakurikuler/foto");
  assert.equal(received[0].url.searchParams.get("per_page"), "5"); assert.equal(received[0].url.searchParams.has("search"), false);
  assert.equal(received[0].headers.authorization, "Bearer photos-token");
  assert.equal(photos[0].url, `${apiClient.defaults.baseURL}/storage/pramuka.jpg`);
  payload = { foto: Array.from({ length: 7 }, (_, index) => ({ id_foto: String(index), url: `/storage/${index}.webp` })) };
  assert.equal((await extracurricularApi.getPhotos()).length, 5);
});

test("foto invalid ditolak sebelum HTTP dan galeri gagal bukan galeri kosong", async () => {
  await assert.rejects(extracurricularApi.create({ ...values, foto: [new File(["bad"], "foto.png", { type: "image/png" })] }));
  assert.equal(received.length, 0);
  for (const body of [{ success: false, data: [] }, { data: null }, {}]) { payload = body; await assert.rejects(extracurricularApi.getPhotos()); }
  payload = { data: [] }; assert.deepEqual(await extracurricularApi.getPhotos(), []);
});

test("validasi dan error HTTP unggah dipertahankan beserta field foto", async () => {
  for (const code of [401, 403, 413, 422, 500]) {
    status = code; payload = { errors: { "foto.0": ["Foto belum valid."] } };
    await assert.rejects(extracurricularApi.create({ ...values, foto: [file()] }), (error) => error.response.status === code);
  }
});

test("unggahan yang sedang berlangsung dapat dibatalkan melalui AbortSignal", { timeout: 3000 }, async () => {
  hold = true; const waiting = new Promise((resolve) => { started = resolve; }); const controller = new AbortController();
  const cancelled = assert.rejects(extracurricularApi.create({ ...values, foto: [file()] }, { signal: controller.signal }), axios.isCancel);
  await waiting; controller.abort(); await cancelled;
});

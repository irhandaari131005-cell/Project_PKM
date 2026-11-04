import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import axios from "axios";
import { apiClient } from "../src/services/api.js";
import { extracurricularApi } from "../src/services/extracurricular.js";
import { schedulesApi } from "../src/services/schedules.js";

const originalBaseURL = apiClient.defaults.baseURL, originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const meeting = { hari: "senin", jam_mulai: "07:00", jam_selesai: "08:30" };
const resources = [
  { api: extracurricularApi, endpoint: "/api/ekstrakurikuler", record: { id_ekstrakurikuler: "001", nama_ekstrakurikuler: "Pramuka" }, values: { ...meeting, nama_ekstrakurikuler: "Pramuka", id_pembina: "002" } },
  { api: schedulesApi, endpoint: "/api/jadwal", record: { id_jadwal: "001", mata_pelajaran: "Matematika" }, values: { ...meeting, id_kelas: "003", id_guru: "002", mata_pelajaran: "Matematika" } },
];
let received, status, payload, holdWrite, writeStarted;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const resource = resources.find((item) => url.pathname === item.endpoint || url.pathname.startsWith(`${item.endpoint}/`));
  if (!resource) { res.writeHead(404).end(); return; }
  const item = { method: req.method, url, headers: req.headers }; received.push(item);
  res.setHeader("Content-Type", "application/json");
  if (req.method === "GET") {
    const fallback = url.pathname === resource.endpoint ? { data: { data: [resource.record], current_page: Number(url.searchParams.get("page") || 1), last_page: 3 } } : { data: resource.record };
    res.statusCode = status; res.end(JSON.stringify(payload ?? fallback)); return;
  }
  let body = ""; req.setEncoding("utf8"); req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    item.body = JSON.parse(body); writeStarted?.(); if (holdWrite) return;
    res.statusCode = status === 200 && req.method === "POST" ? 201 : status;
    res.end(JSON.stringify(payload ?? { data: resource.record }));
  });
});
before(async () => { await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); apiClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}`; apiClient.defaults.proxy = false; });
beforeEach(() => { received = []; status = 200; payload = null; holdWrite = false; writeStarted = undefined; Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "activities-token" } }); });
afterEach(() => { if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else delete globalThis.localStorage; });
after(async () => { apiClient.defaults.baseURL = originalBaseURL; apiClient.defaults.proxy = originalProxy; server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });

for (const resource of resources) {
  test(`${resource.endpoint}: GET mengirim search/hari/page, token, dan paginator Laravel`, async () => {
    const result = await resource.api.list({ search: " tes ", hari: "senin", page: 2, id_kelas: "003" });
    assert.equal(received[0].method, "GET"); assert.equal(received[0].url.pathname, resource.endpoint);
    assert.equal(received[0].url.searchParams.get("search"), "tes"); assert.equal(received[0].url.searchParams.get("hari"), "senin"); assert.equal(received[0].url.searchParams.get("page"), "2");
    assert.equal(received[0].url.searchParams.get("id_kelas"), resource.api === schedulesApi ? "003" : null);
    assert.equal(received[0].headers.authorization, "Bearer activities-token");
    assert.equal(result.currentPage, 2); assert.equal(result.lastPage, 3); assert.deepEqual(result.items[0], resource.record);
  });
  test(`${resource.endpoint}: POST/PUT JSON hanya mengirim field kontrak dan ID nol depan`, async () => {
    await resource.api.create({ ...resource.values, is_admin: true }); await resource.api.update("001", resource.values);
    assert.deepEqual(received.map((item) => [item.method, item.url.pathname]), [["POST", resource.endpoint], ["PUT", `${resource.endpoint}/001`]]);
    for (const item of received) {
      assert.equal(item.headers.authorization, "Bearer activities-token"); assert.match(item.headers["content-type"], /application\/json/); assert.equal(Object.hasOwn(item.body, "is_admin"), false);
      for (const [key, value] of Object.entries(resource.values)) assert.equal(item.body[key], value);
    }
  });
  test(`${resource.endpoint}: detail dan edit menolak ID respons berbeda`, async () => {
    assert.deepEqual((await resource.api.detail("001")).record, resource.record);
    payload = { data: { ...resource.record, [resource.api === schedulesApi ? "id_jadwal" : "id_ekstrakurikuler"]: "002" } };
    await assert.rejects(resource.api.detail("001"), /ID respons berbeda/); await assert.rejects(resource.api.update("001", resource.values), /ID respons berbeda/);
  });
  test(`${resource.endpoint}: input tidak valid tidak mengirim request HTTP`, async () => {
    await assert.rejects(resource.api.create({ ...resource.values, jam_selesai: "06:00" }));
    await assert.rejects(resource.api.list({ page: 0 }));
    for (const id of ["", "..", 1]) await assert.rejects(resource.api.detail(id));
    assert.equal(received.length, 0);
  });
  test(`${resource.endpoint}: respons error, kosong, dan tanpa identifier ditolak`, async () => {
    for (const bad of [{ success: false }, { data: { status: 422 } }, {}, { data: [] }, { message: "Tanpa record" }]) {
      payload = bad; await assert.rejects(resource.api.create(resource.values)); await assert.rejects(resource.api.update("001", resource.values));
    }
    for (const bad of [{ data: [{}] }, { status: false, data: [] }, { data: { success: false, data: [] } }, { data: [resource.record], current_page: 2 }]) { payload = bad; await assert.rejects(resource.api.list()); }
  });
  test(`${resource.endpoint}: HTTP sesi, izin, konflik, validasi dan server diteruskan`, async () => {
    for (const responseStatus of [401, 403, 404, 409, 422, 500]) {
      status = responseStatus; payload = { errors: { jam_mulai: ["Periksa jam." ] } };
      for (const operation of [() => resource.api.list(), () => resource.api.detail("001"), () => resource.api.create(resource.values), () => resource.api.update("001", resource.values)]) await assert.rejects(operation(), (error) => error.response.status === responseStatus);
    }
  });
  test(`${resource.endpoint}: AbortSignal membatalkan request tulis yang sedang berlangsung`, { timeout: 3000 }, async () => {
    holdWrite = true; const started = new Promise((resolve) => { writeStarted = resolve; }); const controller = new AbortController();
    const cancelled = assert.rejects(resource.api.update("001", resource.values, { signal: controller.signal }), axios.isCancel);
    await started; controller.abort(); await cancelled;
  });
}

test("ID detail di-encode sebagai satu segmen URL", async () => {
  payload = { data: { id_jadwal: "X/001 ?", mata_pelajaran: "Matematika" } };
  await schedulesApi.detail("X/001 ?"); assert.equal(received[0].url.pathname, "/api/jadwal/X%2F001%20%3F");
});

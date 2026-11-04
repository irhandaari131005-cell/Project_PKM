import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import axios from "axios";
import { apiClient } from "../src/services/api.js";
import { attendanceHistoryApi, getHistoryRow } from "../src/services/attendanceHistory.js";

const originalBaseURL = apiClient.defaults.baseURL;
const originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let received, classPages, responseStatus, historyPayload, holdHistory, historyStarted;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  received.push({ method: req.method, url, headers: req.headers });
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/api/data_kelas") {
    res.end(JSON.stringify(classPages[Number(url.searchParams.get("page")) - 1]));
  } else if (url.pathname === "/api/absensi/riwayat") {
    historyStarted?.();
    if (holdHistory) return;
    res.statusCode = responseStatus;
    res.end(JSON.stringify(historyPayload));
  } else res.writeHead(404).end();
});

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}`;
  apiClient.defaults.proxy = false;
});
beforeEach(() => {
  received = [];
  classPages = [{ data: [{ id_kelas: "001", nama_kelas: "X-AKL" }] }];
  responseStatus = 200;
  historyPayload = { data: [{ id_absensi: "1", nama_siswa: "Akbar", status_kehadiran: "hadir" }] };
  holdHistory = false;
  historyStarted = undefined;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "history-token" } });
});
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});
after(async () => {
  apiClient.defaults.baseURL = originalBaseURL;
  apiClient.defaults.proxy = originalProxy;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("riwayat memakai GET, query kelas/tanggal/page, dan Bearer token Axios", async () => {
  const result = await attendanceHistoryApi.getHistory({ id_kelas: "001", tanggal: "2026-08-12", page: 2 });
  const incoming = received[0];
  assert.equal(incoming.method, "GET");
  assert.equal(incoming.url.pathname, "/api/absensi/riwayat");
  assert.equal(incoming.url.searchParams.get("id_kelas"), "001");
  assert.equal(incoming.url.searchParams.get("tanggal"), "2026-08-12");
  assert.equal(incoming.url.searchParams.get("page"), "2");
  assert.equal(incoming.headers.authorization, "Bearer history-token");
  assert.equal(incoming.headers.accept, "application/json");
  assert.equal(result.items[0].nama_siswa, "Akbar");
});

test("pilihan semua kelas tidak mengirim ID kosong dan tanggal invalid tidak mengirim request", async () => {
  await attendanceHistoryApi.getHistory({ tanggal: "2026-08-12" });
  assert.equal(received[0].url.searchParams.has("id_kelas"), false);
  await assert.rejects(attendanceHistoryApi.getHistory({ tanggal: "2026-02-30" }));
  assert.equal(received.length, 1);
});

test("riwayat CodeIgniter mempertahankan nama siswa, kelas, dan metadata halaman", async () => {
  historyPayload = {
    status: 200,
    data: [{ id_absensi: 1, id_siswa: 7, nama_siswa: "Akbar", id_kelas: 1, nama_kelas: "X RPL 1", status_kehadiran: "hadir" }],
    meta: { current_page: 2, last_page: 3, per_page: 25, total: 51, from: 26, to: 26 },
  };
  const result = await attendanceHistoryApi.getHistory({ id_kelas: "1", tanggal: "2026-10-21", page: 2 });
  assert.deepEqual(getHistoryRow(result.items[0]), {
    id: "1", name: "Akbar", className: "X RPL 1", status: "Hadir",
  });
  assert.equal(result.currentPage, 2);
  assert.equal(result.lastPage, 3);
  assert.equal(result.offset, 25);
});

test("seluruh halaman daftar kelas dimuat dengan ID string utuh", async () => {
  classPages = [
    { data: [{ id_kelas: "001", nama_kelas: "X-AKL" }], current_page: 1, last_page: 2 },
    { data: [{ id_kelas: "002", nama_kelas: "XI-AKL" }], current_page: 2, last_page: 2 },
  ];
  const result = await attendanceHistoryApi.getClasses();
  assert.deepEqual(result.map(({ id, name }) => ({ id, name })), [{ id: "001", name: "X-AKL" }, { id: "002", name: "XI-AKL" }]);
  assert.deepEqual(received.map(({ url }) => url.searchParams.get("page")), ["1", "2"]);
  assert.ok(received.every(({ url }) => url.pathname === "/api/data_kelas"));
  assert.ok(received.every(({ method, headers }) => method === "GET" && headers.authorization === "Bearer history-token"));
});

test("daftar kelas tanpa ID/nama ditolak agar pilihan filter tidak salah", async () => {
  classPages = [{ data: [{ nama_kelas: "X-AKL" }] }];
  await assert.rejects(attendanceHistoryApi.getClasses(), /ID dan nama kelas/);
});

test("error HTTP dan error di pembungkus riwayat tidak dianggap sebagai daftar kosong", async () => {
  for (const status of [401, 403, 422, 500]) {
    responseStatus = status;
    await assert.rejects(attendanceHistoryApi.getHistory({ tanggal: "2026-08-12" }), (error) => error.response.status === status);
  }
  responseStatus = 200;
  historyPayload = { status: 403, data: [] };
  await assert.rejects(attendanceHistoryApi.getHistory({ tanggal: "2026-08-12" }), (error) => error.response.status === 403);
});

test("request riwayat yang sedang berjalan mendukung pembatalan saat filter berubah", { timeout: 3000 }, async () => {
  holdHistory = true;
  const started = new Promise((resolve) => { historyStarted = resolve; });
  const controller = new AbortController();
  const cancelled = assert.rejects(attendanceHistoryApi.getHistory(
    { tanggal: "2026-08-12" }, { signal: controller.signal },
  ), axios.isCancel);
  await started;
  controller.abort();
  await cancelled;
});

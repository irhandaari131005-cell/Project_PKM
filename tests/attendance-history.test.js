import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoryParams, getHistoryError, getHistoryRow, getJakartaDate, isValidHistoryDate, normalizeHistoryCollection } from "../src/services/attendanceHistory.js";

test("tanggal awal riwayat mengikuti WIB meskipun tanggal UTC masih hari sebelumnya", () => {
  assert.equal(getJakartaDate(new Date("2026-10-16T17:05:00Z")), "2026-10-17");
  assert.equal(getJakartaDate(new Date("2026-10-16T16:59:00Z")), "2026-10-16");
});

test("filter riwayat hanya mengirim kelas, tanggal ISO, dan halaman yang valid", () => {
  assert.deepEqual(buildHistoryParams({ id_kelas: " 001 ", tanggal: "2026-08-12", page: 2, status: "hadir" }), {
    id_kelas: "001", tanggal: "2026-08-12", page: 2,
  });
  assert.deepEqual(buildHistoryParams({ tanggal: "2026-08-12" }), { tanggal: "2026-08-12", page: 1 });
});

test("tanggal kalender tidak valid, ID numerik, dan nomor halaman tidak valid ditolak", () => {
  for (const tanggal of ["", "12-08-2026", "2026-02-30", "2026-02-29", "2026-13-01"]) {
    assert.equal(isValidHistoryDate(tanggal), false);
    assert.throws(() => buildHistoryParams({ tanggal }), (error) => Boolean(getHistoryError(error).fields.tanggal));
  }
  assert.equal(isValidHistoryDate("2024-02-29"), true);
  for (const page of [0, -1, 1.5, "2"]) {
    assert.throws(() => buildHistoryParams({ tanggal: "2026-08-12", page }));
  }
  assert.throws(() => buildHistoryParams({ id_kelas: 1, tanggal: "2026-08-12" }));
});

test("daftar riwayat mendukung array dan paginator Laravel tanpa mengubah record", () => {
  const records = [{ id_absensi: "001", nama_siswa: "Akbar Maulana", status_kehadiran: "hadir", tambahan: { nilai: null } }];
  const payload = { status: 200, data: { data: records, current_page: 2, last_page: 4, per_page: 25, from: 26 } };
  const result = normalizeHistoryCollection(payload);
  assert.equal(result.payload, payload);
  assert.equal(result.items, records);
  assert.equal(result.currentPage, 2);
  assert.equal(result.lastPage, 4);
  assert.equal(result.offset, 25);
  assert.equal(normalizeHistoryCollection(records).items, records);
  assert.equal(normalizeHistoryCollection({ riwayat: records }).items, records);
  assert.equal(normalizeHistoryCollection({ data: records, meta: { current_page: 3, last_page: 3, per_page: 10 } }).offset, 20);
});

test("data kosong valid dibedakan dari respons rusak dan kegagalan JSON", () => {
  assert.deepEqual(normalizeHistoryCollection({ data: [] }).items, []);
  for (const payload of [null, {}, "<html></html>", { data: null }, { data: [null] }]) {
    assert.throws(() => normalizeHistoryCollection(payload));
  }
  for (const payload of [{ status: 403, data: [] }, { success: false, data: [] }, { status: false, data: [] }]) {
    assert.throws(() => normalizeHistoryCollection(payload), (error) => Boolean(error.response.status));
  }
});

test("nama dan status kehadiran dipetakan tanpa menganggap record kosong sebagai hadir", () => {
  assert.deepEqual(getHistoryRow({ id_absensi: "001", nama_siswa: "Akbar", status_kehadiran: "HADIR" }), {
    id: "001", name: "Akbar", className: "Belum ada kelas", status: "Hadir",
  });
  assert.equal(getHistoryRow({ siswa: { nama_siswa: "Irhanda" }, status: "izin" }).name, "Irhanda");
  assert.equal(getHistoryRow({ status: "izin" }).status, "Izin");
  assert.equal(getHistoryRow({ status: "ACTIVE" }).status, "ACTIVE");
  assert.equal(getHistoryRow({}).status, "—");
  assert.equal(getHistoryRow({ nama_kelas: "X RPL 1" }).className, "X RPL 1");
  assert.equal(getHistoryRow({ kelas: { nama_kelas: "XI TKJ 1" } }).className, "XI TKJ 1");
});

test("error riwayat memetakan validasi dan membedakan autentikasi, izin, serta timeout", () => {
  assert.equal(getHistoryError({ response: { status: 422, data: { errors: { tanggal: ["Tanggal salah."] } } } }).fields.tanggal, "Tanggal salah.");
  assert.match(getHistoryError({ response: { status: 401 } }).message, /login kembali/);
  assert.match(getHistoryError({ response: { status: 403 } }).message, /akses/);
  assert.match(getHistoryError({ code: "ECONNABORTED" }).message, /Waktu tunggu/);
});

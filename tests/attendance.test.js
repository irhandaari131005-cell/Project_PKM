import test from "node:test";
import assert from "node:assert/strict";
import { buildAttendancePayload, getAttendanceError, normalizeAttendanceResponse } from "../src/services/attendance.js";

test("payload absensi mempertahankan nomor kartu sebagai string dan hanya mengirim field yang diperlukan", () => {
  for (const jenis_absensi of ["masuk", "pulang"]) {
    assert.deepEqual(buildAttendancePayload({ sn: " 00123456 ", jenis_absensi, id_siswa: "99", status: "hadir" }), {
      sn: "00123456", jenis_absensi,
    });
  }
});

test("nomor kartu kosong atau numerik dan jenis absensi yang tidak dikenal ditolak", () => {
  for (const sn of ["", " ", null, 123456]) {
    assert.throws(() => buildAttendancePayload({ sn, jenis_absensi: "masuk" }),
      (error) => Boolean(getAttendanceError(error).fields.sn));
  }
  assert.throws(() => buildAttendancePayload({ sn: "00123", jenis_absensi: "guru" }),
    (error) => Boolean(getAttendanceError(error).fields.jenis_absensi));
});

test("respons absensi mempertahankan record asli dan memerlukan konfirmasi server", () => {
  const record = { id_absensi: "1", sn: "00123", nama_siswa: "Andi", jenis_absensi: "masuk", waktu: "2026-10-17T00:00:00Z" };
  const payload = { status: 201, message: "Absensi masuk berhasil.", data: record };
  const result = normalizeAttendanceResponse(payload);
  assert.equal(result.payload, payload);
  assert.equal(result.record, record);
  assert.equal(result.message, payload.message);
  assert.equal(normalizeAttendanceResponse({ message: "Berhasil disimpan." }).message, "Berhasil disimpan.");
  assert.equal(normalizeAttendanceResponse(record).record, record);
});

test("respons kosong, array, HTML, dan pembungkus gagal tidak dianggap presensi berhasil", () => {
  for (const payload of [null, {}, [], "<html></html>", { data: [] }, { data: "invalid" }]) {
    assert.throws(() => normalizeAttendanceResponse(payload));
  }
  for (const payload of [{ status: 409 }, { status: false }, { success: false }]) {
    assert.throws(() => normalizeAttendanceResponse(payload), (error) => Boolean(error.response.status));
  }
});

test("error validasi Laravel dipetakan ke nomor kartu dan jenis absensi", () => {
  assert.deepEqual(getAttendanceError({ response: { status: 422, data: { errors: {
    sn: ["Kartu belum terdaftar."], jenis_absensi: "Jenis absensi tidak sesuai.",
  } } } }).fields, { sn: "Kartu belum terdaftar.", jenis_absensi: "Jenis absensi tidak sesuai." });
});

test("pesan error absensi membedakan sesi, izin, duplikat, koneksi, dan timeout", () => {
  assert.match(getAttendanceError({ response: { status: 401 } }).message, /login kembali/);
  assert.match(getAttendanceError({ response: { status: 403 } }).message, /izin/);
  assert.match(getAttendanceError({ response: { status: 409 } }).message, /sudah tercatat/);
  assert.match(getAttendanceError({ code: "ERR_NETWORK" }).message, /koneksi/);
  assert.match(getAttendanceError({ code: "ECONNABORTED" }).message, /belum merespons/);
});

test("pesan 404/409 dari server ditampilkan apa adanya agar petugas tahu siswa mana yang bermasalah", () => {
  assert.equal(getAttendanceError({ response: { status: 409, data: { message: "Andi sudah absen pulang hari ini." } } }).message,
    "Andi sudah absen pulang hari ini.");
  assert.equal(getAttendanceError({ response: { status: 404, data: { message: "Kartu RFID belum terdaftar pada data siswa." } } }).message,
    "Kartu RFID belum terdaftar pada data siswa.");
  assert.match(getAttendanceError({ response: { status: 409, data: { message: "  " } } }).message, /sudah tercatat/);
});

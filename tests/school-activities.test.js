import test from "node:test";
import assert from "node:assert/strict";
import { buildActivityFilters, dayLabel, getActivityError, viewTime } from "../src/services/activityApi.js";
import { buildExtracurricularPayload, getExtracurricularView } from "../src/services/extracurricular.js";
import { buildSchedulePayload, getScheduleView } from "../src/services/schedules.js";

const meeting = { hari: "senin", jam_mulai: "07:00", jam_selesai: "08:30" };
const extra = { ...meeting, nama_ekstrakurikuler: " Pramuka ", id_pembina: " 002 ", lokasi: " Lapangan ", deskripsi: " Latihan mingguan ", status: "ACTIVE" };
const schedule = { ...meeting, id_kelas: " 001 ", id_guru: " 002 ", mata_pelajaran: " Matematika ", ruangan: " R-01 " };

test("payload ekstrakurikuler memilih field kontrak dan mempertahankan ID string", () => {
  assert.deepEqual(buildExtracurricularPayload({ ...extra, jumlah_anggota: 999, id_ekstrakurikuler: "123", is_admin: true }), {
    ...meeting, nama_ekstrakurikuler: "Pramuka", id_pembina: "002", lokasi: "Lapangan", deskripsi: "Latihan mingguan", status: "ACTIVE",
  });
  const result = buildExtracurricularPayload({ ...meeting, nama_ekstrakurikuler: "Pramuka" });
  assert.equal(result.id_pembina, null);
  assert.equal(result.lokasi, null);
  assert.equal(result.deskripsi, null);
  assert.equal(result.status, "ACTIVE");
});

test("payload jadwal membutuhkan kelas/guru/mapel dan tidak mengirim field asing", () => {
  assert.deepEqual(buildSchedulePayload({ ...schedule, id_jadwal: "999", nama_guru: "diabaikan", total: 100 }), { ...meeting, id_kelas: "001", id_guru: "002", mata_pelajaran: "Matematika", ruangan: "R-01" });
  assert.equal(buildSchedulePayload({ ...schedule, ruangan: " " }).ruangan, null);
  for (const field of ["id_kelas", "id_guru", "mata_pelajaran"]) {
    for (const value of [" ", undefined, 123]) assert.throws(() => buildSchedulePayload({ ...schedule, [field]: value }), (error) => Boolean(getActivityError(error).fields[field]));
  }
});

test("hari, format jam, dan urutan waktu divalidasi untuk kedua resource", () => {
  for (const [build, values] of [[buildSchedulePayload, schedule], [buildExtracurricularPayload, extra]]) {
    for (const change of [{ hari: "senenn" }, { jam_mulai: "24:00" }, { jam_mulai: "7:00" }, { jam_selesai: "08:99" }, { jam_mulai: "09:00", jam_selesai: "08:00" }, { jam_mulai: "08:00", jam_selesai: "08:00" }]) assert.throws(() => build({ ...values, ...change }));
    assert.equal(build({ ...values, hari: " Senin " }).hari, "senin");
  }
});

test("input wajib kosong dan field opsional bertipe salah ditolak", () => {
  for (const values of [null, {}, { ...extra, nama_ekstrakurikuler: " " }, { ...extra, id_pembina: 2 }, { ...extra, lokasi: {} }, { ...extra, deskripsi: [] }, { ...extra, status: "admin" }]) assert.throws(() => buildExtracurricularPayload(values));
  assert.throws(() => buildSchedulePayload(null));
  assert.throws(() => buildSchedulePayload({ ...schedule, ruangan: {} }));
});

test("filter hanya mengirim pencarian, hari, kelas, dan page yang diizinkan", () => {
  assert.deepEqual(buildActivityFilters({ search: " Matematika ", hari: "senin", page: 2, id_kelas: " 001 ", role: "admin" }, true), { search: "Matematika", hari: "senin", page: 2, id_kelas: "001" });
  assert.deepEqual(buildActivityFilters({ id_kelas: "001" }), { page: 1 });
  assert.deepEqual(buildActivityFilters(), { page: 1 });
  for (const values of [{ search: 1 }, { hari: "Senin" }, { hari: null }, { page: 0 }, { page: "1" }, { id_kelas: 1 }]) assert.throws(() => buildActivityFilters(values, true));
});

test("tampilan ekstrakurikuler memisahkan pembina dan anggota, memakai jumlah asli termasuk nol", () => {
  const item = getExtracurricularView({ id_ekstrakurikuler: "001", nama_ekstrakurikuler: "Pramuka", pembina: { id_guru: "002", nama: "Bu Sri" }, jumlah_anggota: 0, hari: "SENIN", jam_mulai: "15:00:00", jam_selesai: "16:30:00", status: "ACTIVE" });
  assert.equal(item.id, "001"); assert.equal(item.teacherId, "002"); assert.equal(item.teacherName, "Bu Sri");
  assert.equal(item.members, 0); assert.equal(item.start, "15:00"); assert.equal(item.end, "16:30"); assert.equal(item.hari, "senin");
  for (const jumlah_anggota of [null, undefined, "", true, -1, "abc"]) assert.equal(getExtracurricularView({ jumlah_anggota }).members, null);
});

test("tampilan jadwal membaca relasi kelas/guru tanpa mengubah identifier", () => {
  const item = getScheduleView({ id_jadwal: "001", mata_pelajaran: "Matematika", kelas: { id_kelas: "002", nama_kelas: "X AKL" }, guru: { id_guru: "003", nama: "Pak Jaka" }, jam_mulai: "07:00:00", ruangan: "R-01" });
  assert.equal(item.id, "001"); assert.equal(item.classId, "002"); assert.equal(item.className, "X AKL");
  assert.equal(item.teacherId, "003"); assert.equal(item.teacherName, "Pak Jaka"); assert.equal(item.start, "07:00");
  assert.equal(dayLabel("senin"), "Senin"); assert.equal(dayLabel(""), "—"); assert.equal(viewTime("07:00:00"), "07:00");
});

test("error backend mempertahankan validasi field dan membedakan konflik, sesi, akses, dan timeout", () => {
  assert.deepEqual(getActivityError({ response: { status: 422, data: { errors: { jam_selesai: ["Jam bertabrakan."], id_guru: "Guru tidak tersedia." } } } }).fields, { jam_selesai: "Jam bertabrakan.", id_guru: "Guru tidak tersedia." });
  for (const [status, pattern] of [[401, /login/], [403, /izin/], [404, /tidak ditemukan/], [409, /berbenturan/], [429, /Terlalu banyak/]]) assert.match(getActivityError({ response: { status } }).message, pattern);
  assert.match(getActivityError({ code: "ECONNABORTED" }, "save").message, /Periksa data/);
});

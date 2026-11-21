import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHistoryParams, getHistoryError, getHistoryTimes, historyDayCount, normalizeHistoryRecap,
  shiftHistoryDate, startOfHistoryWeek,
} from "../src/services/attendanceHistory.js";
import { getDashboardInsights } from "../src/pages/DashboardPage/dashboardData.js";

test("riwayat 4 filter: kelas, cari murid, dari, sampai", () => {
  assert.deepEqual(buildHistoryParams({ id_kelas: " 2 ", search: " andi ", dari: "2026-11-16", sampai: "2026-11-21", page: 1 }),
    { dari: "2026-11-16", sampai: "2026-11-21", page: 1, id_kelas: "2", search: "andi" });
  // Filter kosong tidak dikirim.
  assert.deepEqual(buildHistoryParams({ id_kelas: "", search: "  ", dari: "2026-11-21", sampai: "2026-11-21" }),
    { dari: "2026-11-21", sampai: "2026-11-21", page: 1 });
  // Format lama { tanggal } tetap berjalan.
  assert.deepEqual(buildHistoryParams({ tanggal: "2026-11-21" }), { tanggal: "2026-11-21", page: 1 });
});

test("rentang tanggal tidak valid ditolak sebelum request", () => {
  const field = (filters) => {
    try { buildHistoryParams({ search: "", ...filters }); return null; } catch (error) { return Object.keys(getHistoryError(error).fields)[0]; }
  };
  assert.equal(field({ dari: "2026-11-21", sampai: "2026-11-01" }), "sampai");
  assert.equal(field({ dari: "2026-01-01", sampai: "2026-06-01" }), "sampai");
  assert.equal(field({ dari: "2026-02-30", sampai: "2026-03-01" }), "dari");
  assert.equal(field({ dari: "2026-03-01", sampai: "2026-03-01", search: "x".repeat(101) }), "search");
  assert.match(getHistoryError({ response: { status: 422, data: { errors: { sampai: "Tanggal akhir tidak boleh sebelum tanggal awal." } } } }).message, /Tanggal akhir/);
});

test("helper tanggal: jumlah hari, geser, dan Senin awal minggu", () => {
  assert.equal(historyDayCount("2026-11-15", "2026-11-21"), 7);
  assert.equal(historyDayCount("2026-11-21", "2026-11-21"), 1);
  assert.equal(shiftHistoryDate("2026-03-01", -1), "2026-02-28");
  assert.equal(startOfHistoryWeek("2026-11-21"), "2026-11-16"); // Sabtu -> Senin
  assert.equal(startOfHistoryWeek("2026-11-16"), "2026-11-16");
  assert.equal(startOfHistoryWeek("2026-11-22"), "2026-11-16"); // Minggu -> Senin minggu itu
});

test("rekap dan jam riwayat dipetakan dari respons backend", () => {
  const recap = normalizeHistoryRecap({ rekap: {
    dari: "2026-11-16", sampai: "2026-11-21", jumlah_hari: 6, hari_tercatat: 5, total_siswa: 2,
    siswa: [{ id_siswa: 1, nama_siswa: "Andi", nama_kelas: "X RPL", jumlah_hadir: 4 }, { id_siswa: 2, nama_siswa: "Budi", nama_kelas: null, jumlah_hadir: "0" }, null],
  } });
  assert.deepEqual(recap, {
    dari: "2026-11-16", sampai: "2026-11-21", days: 6, recordedDays: 5, total: 2,
    students: [
      { id: "1", name: "Andi", className: "X RPL", present: 4 },
      { id: "2", name: "Budi", className: "Belum ada kelas", present: 0 },
    ],
  });
  assert.equal(normalizeHistoryRecap({ data: [] }), null);
  assert.deepEqual(getHistoryTimes({ tanggal: "2026-11-21", check_in: "2026-11-21 07:05:12", check_out: null }),
    { date: "2026-11-21", checkIn: "07:05", checkOut: "" });
});

test("panel dashboard: kehadiran, tren, jadwal, ekskul, absensi terbaru, kehadiran saya", () => {
  const insights = getDashboardInsights({
    kehadiran: { hadir_hari_ini: 3, total_siswa: 10, sudah_pulang: 1, belum_hadir: 7 },
    tren_kehadiran: [{ tanggal: "2026-11-20", hari: "jumat", hadir: 5 }, { tanggal: "2026-11-21", hari: "sabtu", hadir: 3 }],
    jadwal_hari_ini: [{ mata_pelajaran: "Matematika", jam_mulai: "07:00:00", jam_selesai: "08:30", nama_kelas: "X RPL", nama_guru: "Bu Ani", ruangan: null }],
    ekskul_hari_ini: [{ nama_ekstrakurikuler: "Pramuka", jam_mulai: "14:00", jam_selesai: "16:00", lokasi: "Lapangan" }],
    absensi_terbaru: [{ nama_siswa: "Andi", nama_kelas: null, check_in: "2026-11-21 07:01:00", check_out: null }],
    kehadiran_saya: { hari_ini: { check_in: "2026-11-21 07:01:00", check_out: null }, minggu_ini: 4, bulan_ini: 12 },
  });
  assert.deepEqual(insights.attendance, { present: 3, total: 10, left: 1, absent: 7 });
  assert.deepEqual(insights.trend.at(-1), { date: "2026-11-21", day: "sabtu", present: 3 });
  assert.deepEqual(insights.schedule[0], { title: "Matematika", start: "07:00", end: "08:30", className: "X RPL", teacher: "Bu Ani", room: "" });
  assert.equal(insights.extracurriculars[0].location, "Lapangan");
  assert.deepEqual(insights.latest[0], { name: "Andi", className: "Belum ada kelas", checkIn: "07:01", checkOut: "" });
  assert.deepEqual(insights.mine, { today: { checkIn: "07:01", checkOut: "" }, week: 4, month: 12 });
  // Data lama tanpa field baru tetap aman.
  assert.deepEqual(getDashboardInsights({ kehadiran: { hadir_hari_ini: 1 } }).schedule, []);
  assert.equal(getDashboardInsights(null), null);
});

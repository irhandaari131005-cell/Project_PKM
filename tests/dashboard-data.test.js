import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardData, getPersonView, getProfileView, normalizeCollection } from "../src/pages/DashboardPage/dashboardData.js";

test("respons backend siswa memetakan id_siswa, nama_siswa, dan sn", () => {
  const result = normalizeCollection({
    status: 200,
    message: "Data berhasil diambil",
    data: [{
      id_siswa: "1", nama_siswa: "Andi Pratama", status: "ACTIVE",
      created_date: "2026-10-13 21:25:09", update_date: "Admin",
      sn: "1051234561", type: "siswa",
    }],
  }, "data_siswa");

  assert.equal(result.total, 1);
  assert.deepEqual(getPersonView(result.items[0], "data_siswa"), {
    id: "1", name: "Andi Pratama", identifier: "1051234561", description: "-",
  });
});

test("respons backend guru memetakan id_guru, nama, dan sn tanpa kehilangan nol di depan", () => {
  const record = {
    id_guru: "1", nama: "Budi Santoso, S.Pd.", type: "guru",
    created_date: "2026-10-13 21:22:54", sn: "1985010110", update_date: null,
  };
  for (const payload of [[record], { status: 200, message: "Data berhasil diambil", data: [record] }]) {
    const result = normalizeCollection(payload, "data_guru");
    assert.equal(result.total, 1);
    assert.deepEqual(getPersonView(result.items[0], "data_guru"), {
      id: "1", name: "Budi Santoso, S.Pd.", identifier: "1985010110", description: "-",
    });
  }
  assert.equal(getPersonView({ ...record, sn: "001985010110" }, "data_guru").identifier, "001985010110");
});

test("id dan SN dari kontrak backend diprioritaskan atas field alternatif", () => {
  const students = normalizeCollection([{
    id_siswa: "S1", id: "lain", nama_siswa: "Andi", nama: "Nama alternatif", sn: "001", nisn: "999",
  }], "data_siswa");
  const teachers = normalizeCollection([{
    id_guru: "G1", id: "lain", nama: "Budi", sn: "002", nip: "999",
  }], "data_guru");
  const student = getPersonView(students.items[0], "data_siswa");
  const teacher = getPersonView(teachers.items[0], "data_guru");
  assert.equal(student.id, "S1");
  assert.equal(student.name, "Andi");
  assert.equal(student.identifier, "001");
  assert.equal(teacher.id, "G1");
  assert.equal(teacher.identifier, "002");
});

test("status error pada payload tidak ditampilkan sebagai data kosong yang berhasil", () => {
  for (const status of [401, "403", 500]) {
    assert.throws(() => normalizeCollection({ status, message: "Gagal", data: [] }, "data_siswa"),
      (error) => error.status === Number(status));
  }
  assert.equal(normalizeCollection({ status: 200, message: "Berhasil", data: [] }, "data_siswa").total, 0);
});

test("array siswa memetakan identitas dan relasi kelas", () => {
  const result = normalizeCollection([
    { id: 1, nama_siswa: "Ayu", nisn: "00123", kelas: { nama_kelas: "X RPL" } },
  ], "data_siswa");
  assert.equal(result.total, 1);
  assert.deepEqual(getPersonView(result.items[0], "data_siswa"), { id: 1, name: "Ayu", identifier: "00123", description: "X RPL" });
});

test("paginator Laravel memakai total seluruh siswa, bukan panjang halaman", () => {
  const result = normalizeCollection({
    data: [{ nama: "Budi", nis: "42", kelas: "XI TKJ" }],
    current_page: 2, last_page: 8, total: 151,
  }, "data_siswa");
  assert.equal(result.total, 151);
  assert.equal(result.currentPage, 2);
  assert.equal(result.lastPage, 8);
  assert.equal(getPersonView(result.items[0], "data_siswa").identifier, "42");
});

test("Laravel resource membaca meta dan pembungkus data bersarang", () => {
  const result = normalizeCollection({ data: {
    data: [{ id: 8, nama_guru: "Ibu Sari", nip: "001", mata_pelajaran: { nama: "Matematika" } }],
    meta: { current_page: "1", last_page: "3", total: "33" },
  } }, "data_guru");
  assert.equal(result.total, 33);
  assert.equal(result.lastPage, 3);
  const teacher = getPersonView(result.items[0], "data_guru");
  assert.equal(teacher.name, "Ibu Sari");
  assert.equal(teacher.identifier, "001");
  assert.equal(teacher.description, "Matematika");
});

test("nama resource dapat membungkus daftar data", () => {
  const result = normalizeCollection({ data: { data_guru: [{ nama: "Pak Dedi", nig: "G01", jabatan: "Wali Kelas" }] } }, "data_guru");
  assert.equal(result.total, 1);
  assert.equal(getPersonView(result.items[0], "data_guru").identifier, "G01");
  assert.equal(getPersonView(result.items[0], "data_guru").description, "Wali Kelas");
});

test("data kosong menampilkan nol dan total nol dari backend tetap dipertahankan", () => {
  assert.equal(normalizeCollection([], "data_siswa").total, 0);
  assert.equal(normalizeCollection({ data: [], total: 0 }, "data_guru").total, 0);
});

test("paginasi tanpa total tidak menganggap panjang halaman sebagai jumlah seluruh data", () => {
  const result = normalizeCollection({ data: [{ nama: "Ayu" }], current_page: 1, last_page: 4 }, "data_siswa");
  assert.equal(result.total, null);
});

test("respons yang salah ditolak agar tidak ditampilkan sebagai nol siswa", () => {
  for (const payload of [null, {}, { message: "Unauthenticated" }, { data: null }, { data: [null] }]) {
    assert.throws(() => normalizeCollection(payload, "data_siswa"), /Format respons/);
  }
});

test("payload dan seluruh field backend dipertahankan tanpa diubah menjadi alias tampilan", () => {
  const payload = {
    status: 200,
    message: "Data berhasil diambil",
    data: [{
      id_siswa: "001", nama_siswa: "Andi", sn: "000123", status: "ACTIVE", type: "siswa",
      created_date: "2026-10-13 21:25:09", update_date: "Admin",
      tambahan_backend: { nilai: null },
    }],
    trace_id: "test-response",
  };
  const original = structuredClone(payload);
  const collection = normalizeCollection(payload, "data_siswa");
  const view = getPersonView(collection.items[0], "data_siswa");
  assert.equal(view.name, "Andi");
  assert.deepEqual(collection.payload, original);
  assert.deepEqual(collection.items, original.data);
  assert.deepEqual(payload, original);
  assert.equal(Object.hasOwn(collection.items[0], "identifier"), false);
  assert.equal(collection.items[0].created_date, "2026-10-13 21:25:09");
  assert.equal(collection.items[0].update_date, "Admin");
});

test("profil dan sambutan membaca nama serta SN dari payload pengguna yang login", () => {
  for (const record of [
    { id_siswa: "1", nama_siswa: "Andi", sn: "001", type: "siswa", status: "ACTIVE" },
    { id_guru: "1", nama: "Budi", sn: "002", type: "guru", update_date: null },
  ]) {
    const profile = { status: 200, message: "Berhasil", data: record };
    const user = getProfileView(profile);
    assert.equal(user.name, record.nama_siswa ?? record.nama);
    assert.equal(user.identifier, record.sn);
    assert.equal(user.type, record.type);
    const summary = createDashboardData({
      students: { total: 1, loading: false, error: "" },
      teachers: { total: 1, loading: false, error: "" },
      profile,
    });
    assert.equal(summary.welcomeSubtitle, user.name);
  }
  assert.equal(getProfileView(null).name, undefined);
  assert.equal(getProfileView({ data: [{ nama: "Tidak dipilih otomatis" }] }).name, undefined);
});

test("ringkasan mempertahankan jumlah nol serta membedakan data gagal dan belum tersedia", () => {
  const dashboard = createDashboardData({
    students: { total: 0, loading: false, error: "" },
    teachers: { total: null, loading: false, error: "Gagal" },
    profile: { name: "Admin Rina" }, schoolName: "SMK Dharma Karya",
  });
  assert.equal(dashboard.stats.students.value, "0");
  assert.equal(dashboard.stats.teachers.value, "—");
  assert.equal(dashboard.stats.teachers.detail, "Gagal memuat data");
  assert.equal(dashboard.stats.attendance.value, "—");
  assert.equal(dashboard.welcomeSubtitle, "Admin Rina");
});

test("kartu Kehadiran & Ekskul memakai ringkasan dashboard", async () => {
  const { summaryStats } = await import("../src/pages/DashboardPage/dashboardData.js");
  assert.deepEqual(summaryStats({ data: { kehadiran: { hadir_hari_ini: 12, total_siswa: 1200 }, ekstrakurikuler: { aktif: 3, total: 4 } } }), {
    attendance: { label: "Kehadiran", value: "12", detail: "dari 1.200 siswa hari ini" },
    extracurriculars: { label: "Ekskul", value: "3", detail: "Ekskul aktif" },
  });
  assert.deepEqual(summaryStats({ data: { kehadiran: { hadir_hari_ini: 0 }, ekstrakurikuler: { aktif: 0 } } }).attendance,
    { label: "Kehadiran", value: "0", detail: "Hadir hari ini" });
  assert.deepEqual(summaryStats({ loading: true }).attendance, { label: "Kehadiran", value: "…", detail: "Memuat data..." });
  assert.deepEqual(summaryStats({ error: "x" }).extracurriculars, { label: "Ekskul", value: "—", detail: "Gagal memuat data" });
  assert.equal(summaryStats(undefined).attendance.value, "—");
});

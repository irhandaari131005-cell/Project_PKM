import test from "node:test";
import assert from "node:assert/strict";
import { canManageSchoolData, canOpenDashboardView } from "../src/services/access.js";

test("only a teacher profile receives school management permissions", () => {
  assert.equal(canManageSchoolData({ type: "guru" }), true);
  for (const profile of [null, undefined, {}, { type: "siswa" }, { type: "admin" }, { role: "guru" }, { type: ["guru"] }]) {
    assert.equal(canManageSchoolData(profile), false);
  }
});

test("students can view school data, including teachers, but cannot enter attendance or edit", () => {
  for (const view of ["dashboard", "account", "data_siswa", "data_guru", "classes", "attendance-history"]) {
    assert.equal(canOpenDashboardView({ type: "siswa" }, view), true);
    assert.equal(canOpenDashboardView({ type: "guru" }, view), true);
  }
  // Halaman boleh dibuka, tetapi izin tambah/ubah tetap khusus guru.
  assert.equal(canManageSchoolData({ type: "siswa" }), false);
  for (const view of ["attendance", "scan", "edit-profile", "users"]) {
    assert.equal(canOpenDashboardView({ type: "siswa" }, view), false);
  }
  for (const profile of [null, {}, { type: "admin" }]) {
    assert.equal(canOpenDashboardView(profile, "dashboard"), false);
    assert.equal(canOpenDashboardView(profile, "attendance"), false);
  }
});

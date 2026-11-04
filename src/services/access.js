// The profile passed here comes from /api/me, never from localStorage.
export function canManageSchoolData(profile) {
  return profile?.type === "guru";
}

// Siswa boleh membuka halaman data ini dalam mode lihat saja; tombol tambah/ubah
// tetap bergantung pada canManageSchoolData dan backend menolak request tulis (403).
const studentViews = new Set([
  "dashboard", "account", "data_siswa", "data_guru", "classes", "attendance-history",
  "notifications", "violations",
]);

export function canOpenDashboardView(profile, view) {
  return canManageSchoolData(profile)
    || (profile?.type === "siswa" && studentViews.has(view));
}

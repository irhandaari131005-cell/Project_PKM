import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  CircleCheckBig,
  ContactRound,
  Eye,
  EyeOff,
  Flag,
  History,
  House,
  KeyRound,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquare,
  Presentation,
  RefreshCw,
  ScanQrCode,
  School,
  ShieldAlert,
  Trophy,
  User,
  UserCircle,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import useDashboardData from "./useDashboardData.js";
import Attendance from "../AttendancePage/Attendance.jsx";
import AttendanceHistory from "../AttendanceHistoryPage/AttendanceHistory.jsx";
import Students from "../StudentsPage/Students.jsx";
import Teachers from "../TeachersPage/Teachers.jsx";
import Classes from "../ClassesPage/Classes.jsx";
import Extracurricular from "../ExtracurricularPage/Extracurricular.jsx";
import Schedules from "../SchedulesPage/Schedules.jsx";
import Profile from "../ProfilePage/Profile.jsx";
import { createDashboardData, getProfileView } from "./dashboardData.js";
import { canManageSchoolData, canOpenDashboardView } from "../../services/access.js";
import { changePassword, getChangePasswordError } from "../../services/auth.js";

const localViews = new Set([
  "dashboard",
  "account",
  "data_siswa",
  "data_guru",
  "classes",
  "extracurricular",
  "schedules",
  "attendance",
  "attendance-history",
]);

export default function Dashbord({
  profile,
  schoolName = "SMK Dharma Karya",
  onNavigate,
  onProfileUpdated,
  onLogout,
}) {
  const canManage = canManageSchoolData(profile);
  const { students, teachers } = useDashboardData({ includeTeachers: canOpenDashboardView(profile, "data_guru") });
  const [active, setActive] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const dashboard = createDashboardData({
    students,
    teachers,
    profile,
    schoolName,
  });

  useEffect(() => {
    if (!isSidebarOpen && !isChangePasswordOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
        setIsChangePasswordOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSidebarOpen, isChangePasswordOpen]);

  function dispatchNavigation(key) {
    if (onNavigate) onNavigate(key);
    else
      window.dispatchEvent(
        new CustomEvent("school:navigate", { detail: { key } }),
      );
  }

  function handleNavigate(key) {
    setIsSidebarOpen(false);
    const view = key === "scan" ? "attendance" : key;
    if (!canOpenDashboardView(profile, view)) return;
    if (localViews.has(view)) setActive(view);
    else dispatchNavigation(key);
  }

  function handleLogout() {
    if (onLogout) onLogout();
    else dispatchNavigation("logout");
  }

  return (
    <main className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-school-900 sm:min-h-[844px] sm:shadow-2xl">
      <Header
        schoolName={schoolName}
        onMenuClick={() => setIsSidebarOpen(true)}
        onProfileClick={() => handleNavigate("account")}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
      />

      <Sidebar
        open={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        active={active}
        schoolName={schoolName}
        profile={profile}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      {isChangePasswordOpen && (
        <ChangePasswordModal
          open
          username={profile?.username}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      )}

      <div
        className={`relative z-10 mx-3 -mt-24 min-h-[calc(100dvh-54px)] rounded-t-[24px] bg-white pb-28 sm:min-h-[790px] ${["attendance", "attendance-history", "data_siswa", "data_guru", "classes", "extracurricular", "schedules"].includes(active) ? "px-0 pt-0" : "px-3 pt-4"}`}
      >
        {active === "attendance" && canManage && <Attendance />}
        {active === "attendance-history" && <AttendanceHistory />}
        {active === "dashboard" && (
          <>
            <WelcomeCard data={dashboard} />
            <div className="mt-3">
              <StatisticsGrid stats={dashboard.stats} />
            </div>
            {(students.loading || teachers.loading) && (
              <p
                role="status"
                className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600"
              >
                <LoaderCircle size={14} className="animate-spin" /> Memuat data
                dashboard...
              </p>
            )}
            <CollectionError collection={students} />
            <CollectionError collection={teachers} />
          </>
        )}
        {active === "account" && (
          <Profile profile={profile} onProfileUpdated={onProfileUpdated} />
        )}
        {active === "data_siswa" && (
          <Students
            canManage={canManage}
            initialTotal={students.total}
            onStudentCreated={students.reload}
          />
        )}
        {active === "data_guru" && (
          <Teachers canManage={canManage} onTeacherCreated={teachers.reload} />
        )}
        {active === "classes" && <Classes canManage={canManage} />}
        {active === "extracurricular" && <Extracurricular />}
        {active === "schedules" && <Schedules />}
      </div>

      <BottomNavigation profile={profile} active={active} onNavigate={handleNavigate} />
    </main>
  );
}

function Header({
  schoolName,
  onMenuClick,
  onProfileClick,
  onChangePassword,
  onLogout,
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="relative flex h-[150px] items-center justify-between rounded-b-[24px] bg-school-800 px-4 text-white">
      {/* Menu HAMBURGER Strip Section */}
      <button
        type="button"
        aria-label="Buka menu"
        onClick={onMenuClick}
        className="rounded-lg mb-24 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        <Menu className="h-10 w-11" size={30} strokeWidth={3} />
      </button>
      {/* Logo Section */}
      <div className="absolute left-1/2 top-0 flex h-[60px] w-[135px] -translate-x-1/2 items-center justify-center rounded-t-2xl border-x border-b border-white/10 bg-school-950/40">
        <div className="flex h-full w-full pb-1.5 items-center justify-center rounded-t-2xl shadow-[inset_0_4px_2px_rgba(0,0,0,0.3)]">
          <img
            src={`${import.meta.env.BASE_URL}logodhakar.png`}
            alt={`Logo ${schoolName}`}
            className="h-full w-full object-contain"
          />
        </div>
      </div>
      {/* Profile Section  */}
      <div className="relative z-30 ml-auto mb-24 flex items-top gap-1 rounded-lg  transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70">
        <button
          type="button"
          onClick={() => setIsProfileOpen((prev) => !prev)}
          aria-expanded={isProfileOpen}
          aria-label="Menu profil"
          className="flex items-center gap-2 rounded-lg p-2 text-white hover:bg-white/10"
        >
          <UserRound size={32} />
          <ChevronDown
            size={17}
            className={isProfileOpen ? "rotate-180" : ""}
          />
        </button>

        {isProfileOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-2 w-48
                    overflow-hidden rounded-l-[36px] rounded-br-[36px] rounded-tr-xl border border-white/10
                    bg-[#064638] p-2 text-white shadow-xl"
          >
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                onProfileClick?.();
              }}
              className="flex translate-x-4 w-[150px] items-center gap-x-1.5 rounded-lg px-5 py-2 text-xs hover:bg-white/10 bg-school-800"
            >
              <User size={20} />
              Profil Saya
            </button>

            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                onChangePassword?.();
              }}
              className="flex translate-x-4 w-[150px] items-center gap-x-1.5 rounded-lg mt-2 px-5 py-2 text-xs hover:bg-white/10 bg-school-800"
            >
              <KeyRound size={20} />
              Ganti Password
            </button>

            <div
              className="relative right-0 top-full bottom-full z-50 mt-2
                w-56 -translate-x-6 translate-y-2 *:overflow-hidden rounded-2xl
                border border-white/10 bg-school-800
                p-2 text-white shadow-xl"
            >
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  onLogout?.();
                }}
                className="w-3/4 ml-4 translate-x-2 rounded-b-[36px] items-center  bg-red-600 px-3 text-sm hover:bg-red-700"
              >
                <LogOut
                  className="ml-4 translate-x-4 translate-y-2.5"
                  size={20}
                />
                <p className="w-2/12  translate-x-14 -translate-y-[11px] -py-6">
                  Keluar
                </p>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

const menuItems = [
  { key: "dashboard", label: "Dashboard", Icon: House },
  { key: "attendance", label: "Absensi", Icon: CircleCheckBig },
  { key: "attendance-history", label: "Riwayat Absensi", Icon: History },
  { key: "data_siswa", label: "Data Siswa", Icon: ContactRound },
  { key: "data_guru", label: "Data Guru", Icon: UsersRound },
  { key: "classes", label: "Data Kelas", Icon: School },
  { key: "extracurricular", label: "Ekstrakurikuler", Icon: Trophy },
  { key: "schedules", label: "Jadwal", Icon: CalendarDays },
];

function Sidebar({
  open,
  onClose,
  onNavigate,
  onLogout,
  active,
  schoolName,
  profile,
}) {
  if (!open) return null;
  return (
    <>
      {/* Overlay gelap di belakang sidebar */}
      {open && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50"
        />
      )}

      {/* Sidebar */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu dashboard"
        className={`fixed left-0 top-0 z-50 flex h-dvh
          w-[180px] flex-col overflow-hidden
          rounded-r-[28px] border-r border-white/10
          bg-[#003D32] text-white shadow-2xl
          transition-transform duration-300 ease-in-out
          sm:w-[220px]
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Identitas sekolah */}
        <div
          className="flex h-[54px] shrink-0 items-center gap-2
                        rounded-rt-full rounded-bl-3xl  border-b border-white/10
                        bg-[#005343] px-3"
        >
          <img
            src={`${import.meta.env.BASE_URL}logodhakar.png`}
            alt="Logo sekolah"
            className="h-12 w-12 shrink-0 rounded-full object-contain"
          />

          <span className="text-[11px] font-bold leading-tight">
            {schoolName}
          </span>
        </div>

        {/* Daftar menu */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-2 py-2">
          {menuItems.filter(({ key }) => canOpenDashboardView(profile, key)).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onClose();
                onNavigate(key);
              }}
              aria-current={active === key ? "page" : undefined}
              className="flex w-full items-center gap-2
                         rounded-tr-xl  rounded-br-xl border border-white/5
                         bg-[#005343] px-2.5 py-2.5
                         text-left text-[11px]
                         transition-colors hover:bg-[#08715B]"
            >
              <Icon size={20} strokeWidth={2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Profil admin di bagian bawah */}
        <div
          className="mx-2 mb-2 shrink-0 rounded-[24px]
                        border border-white/10 bg-[#005343] p-2"
        >
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate("account");
            }}
            className="flex w-full items-center justify-center gap-1"
          >
            <UserCircle size={30} />
            <span className="text-[10px] font-semibold">
              {getProfileView(profile).name || "Admin"}
              <span className="block text-[8px] font-normal">
                {profile?.type === "guru" ? "Guru" : "Siswa"}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout?.();
            }}
            className="mt-2 flex w-full items-center
                       justify-center gap-1 rounded-full
                       bg-red-700 px-2 py-1.5
                       text-[10px] text-red-200
                       hover:bg-red-600"
          >
            <LogOut size={12} />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}

function ChangePasswordModal({ open, onClose, username }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const request = useRef(null);

  // Modal ditutup saat request berjalan: batalkan agar state tidak diubah setelah unmount.
  useEffect(() => () => request.current?.abort(), []);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSuccess("");

    const controller = new AbortController();
    request.current = controller;
    setSubmitting(true);
    try {
      // Username diambil dari sesi login; pengguna tidak perlu mengetiknya.
      await changePassword({ username, currentPassword, newPassword, confirmPassword }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password berhasil diubah. Gunakan password baru saat login berikutnya.");
    } catch (caught) {
      if (!controller.signal.aborted) setError(getChangePasswordError(caught).message);
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
      request.current = null;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center
                    justify-center bg-black/50 px-3 py-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="relative w-full max-w-[340px] rounded-[24px]
                   border border-white/20 bg-[#003D32] p-4
                   text-white shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup ganti password"
          className="absolute right-3 top-3 rounded-md p-1
                     hover:bg-white/10"
        >
          <X size={20} />
        </button>

        <h2
          id="change-password-title"
          className="mb-5 pr-8 text-base font-bold"
        >
          Ganti Password
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <label
              htmlFor="current-password"
              className="mb-1 block text-[11px]"
            >
              Password saat ini <span className="text-red-400">*</span>
            </label>
            <input
              id="current-password"
              type={showCurrentPassword ? "text" : "password"}
              autoComplete="current-password"
              autoFocus
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300
                         bg-white px-2 pr-9 text-sm text-gray-900
                         outline-none focus:border-emerald-400
                         focus:ring-2 focus:ring-emerald-400/30"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              aria-label={
                showCurrentPassword
                  ? "Sembunyikan password saat ini"
                  : "Tampilkan password saat ini"
              }
              className="absolute bottom-1.5 right-2 text-gray-500 hover:text-gray-800"
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="relative">
            <label htmlFor="new-password" className="mb-1 block text-[11px]">
              Password baru <span className="text-red-400">*</span>
            </label>
            <input
              id="new-password"
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300
                         bg-white px-2 pr-9 text-sm text-gray-900
                         outline-none focus:border-emerald-400
                         focus:ring-2 focus:ring-emerald-400/30"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              aria-label={
                showNewPassword
                  ? "Sembunyikan password baru"
                  : "Tampilkan password baru"
              }
              className="absolute bottom-1.5 right-2 text-gray-500 hover:text-gray-800"
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="relative">
            <label
              htmlFor="confirm-password"
              className="mb-1 block text-[11px]"
            >
              Konfirmasi Password <span className="text-red-400">*</span>
            </label>
            <input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300
                         bg-white px-2 pr-9 text-sm text-gray-900
                         outline-none focus:border-emerald-400
                         focus:ring-2 focus:ring-emerald-400/30"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={
                showConfirmPassword
                  ? "Sembunyikan konfirmasi password"
                  : "Tampilkan konfirmasi password"
              }
              className="absolute bottom-1.5 right-2 text-gray-500 hover:text-gray-800"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="text-xs text-emerald-200">
              {success}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md border border-white px-3 py-1.5
                         text-[11px] transition hover:bg-white
                         hover:text-[#003D32] disabled:opacity-60"
            >
              {submitting && <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />}
              {submitting ? "Menyimpan..." : "Ganti Password"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function WelcomeCard({ data }) {
  return (
    <section className="relative overflow-hidden -mt-1 rounded-xl bg-school-900 px-4 pb-9 pt-4 text-white shadow-card">
      <p className="mb-1 text-[9px] font-medium text-emerald-100/90">
        {data.dateLabel}
      </p>
      <h1 className="text-[17px] font-bold leading-[1.12] tracking-[-0.35px]">
        {data.welcomeTitle}
        <span className="block">{data.welcomeSubtitle}</span>
      </h1>
      <p className="mt-2 max-w-[250px] text-[9px] leading-[1.35] text-emerald-50/90">
        {data.welcomeDescription}
      </p>
      <div
        className=" flex  absolute -bottom-3 right-5 z-0
                h-8 w-32 items-center justify-center
               rounded-t-[24px] border-x border-t border-white/10 shadow-[inset_0_4px_2px_rgba(0,0,0,0.3)]"
      >
        <span className="inline-flex items-center gap-1 rounded-full pb-3 bg-school-950/70 px-2 py-1 text-[8px] text-emerald-50">
          <UserRound size={10} />
          {data.schoolName}
        </span>
      </div>
    </section>
  );
}

const statOrder = ["students", "teachers", "attendance", "extracurriculars"];

function StatisticsGrid({ stats }) {
  return (
    <section
      aria-label="Ringkasan statistik"
      className="rounded-xl bg-school-900 p-2 shadow-card"
    >
      <div className="grid grid-cols-2 gap-2">
        {statOrder.map((key) => (
          <StatCard key={key} statKey={key} stat={stats[key]} />
        ))}
      </div>
    </section>
  );
}

const iconMap = {
  students: Users,
  teachers: Presentation,
  attendance: CalendarCheck,
  extracurriculars: MessageSquare,
};

function StatCard({ stat, statKey }) {
  const Icon = iconMap[statKey] || Users;

  return (
    <article className="min-w-0 rounded-lg bg-school-950 px-2.5 py-2.5 text-white shadow-sm">
      <div className="flex items-start gap-2">
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-white/10 text-emerald-50">
          <Icon size={14} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] leading-tight text-emerald-50/90">
            {stat.label}
          </p>
          <p className="mt-0.5 truncate text-[16px] font-bold leading-none tracking-wide">
            {stat.value}
          </p>
        </div>
      </div>
      <p className="mt-3 truncate text-[8px] text-emerald-100/90">
        {stat.detail}
      </p>
    </article>
  );
}

function CollectionError({ collection }) {
  if (!collection.error) return null;
  return (
    <div
      role="alert"
      className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <p className="flex-1">{collection.error}</p>
      <button
        type="button"
        onClick={collection.reload}
        disabled={collection.loading}
        className="flex shrink-0 items-center gap-1 rounded p-1 hover:bg-amber-100 disabled:opacity-50"
      >
        <RefreshCw size={13} /> Coba lagi
      </button>
    </div>
  );
}

const navItems = [
  { key: "dashboard", label: "Dashboard", Icon: House },
  {
    key: "violations",
    label: "Pelanggaran",
    sublabel: "Siswa",
    Icon: ShieldAlert,
  },
  { key: "scan", label: "Scan Presensi", Icon: ScanQrCode, featured: true },
  { key: "notifications", label: "Notifikasi", Icon: Bell },
  { key: "account", label: "Akun", Icon: UserRound },
];

function BottomNavigation({ active = "dashboard", onNavigate, profile }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-slate-200 bg-white px-1 pb-1 pt-1 shadow-[0_-3px_15px_rgba(0,0,0,0.5)] sm:sticky"
    >
      <div className={`grid h-[45px] items-end ${canManageSchoolData(profile) ? "grid-cols-5" : "grid-cols-4"}`}>
        {navItems.filter(({ key }) => canOpenDashboardView(profile, key === "scan" ? "attendance" : key)).map(({ key, label, sublabel, Icon, featured }) => {
          if (featured) {
            return (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate(key)}
                className="relative flex h-full flex-col items-center justify-end"
                aria-label={label}
                aria-current={active === "attendance" ? "page" : undefined}
              >
                <span className="absolute -top-[34px] flex h-[65px] w-[65px] items-center justify-center rounded-full border-[3px] border-white bg-school-900 text-white shadow-md transition hover:bg-school-800">
                  <Icon size={30} strokeWidth={1.8} />
                </span>
                <span className="mt-auto pb-0.5 text-[8px] font-medium text-school-900">
                  {label}
                </span>
              </button>
            );
          }

          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={selected ? "page" : undefined}
              className={`flex h-full flex-col items-center justify-end gap-0.5 rounded-md pb-[8px] transition ${
                selected
                  ? "text-school-900"
                  : "text-slate-500 hover:text-school-900"
              }`}
            >
              <Icon size={17} strokeWidth={selected ? 2 : 1.6} />
              <span className="text-[8px] leading-tight">{label}</span>
              {sublabel && (
                <span className="-mt-0.5 text-[7px] leading-tight">
                  {sublabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

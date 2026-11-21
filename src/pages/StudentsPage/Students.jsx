import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CircleUserRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { studentsApi, getStudentError, STUDENT_STATUSES } from "../../services/students.js";
import { formatCount } from "../DashboardPage/dashboardData.js";
import { getStudentCard, normalizeStudentsList } from "./studentData.js";

const initialList = {
  items: [],
  total: null,
  loading: true,
  error: null,
  currentPage: 1,
  lastPage: 1,
  key: "",
};

export default function Students({ initialTotal = null, onStudentCreated, canManage = false }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ search: "", page: 1 });
  const [list, setList] = useState(initialList);
  const [classes, setClasses] = useState({
    items: [],
    loading: true,
    error: null,
  });
  const [totals, setTotals] = useState({ students: null, classes: null });
  const [revision, setRevision] = useState(0);
  const [classesRevision, setClassesRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  // Record siswa yang sedang diedit (null = tidak ada form edit terbuka).
  const [editing, setEditing] = useState(null);
  const [success, setSuccess] = useState("");
  const queryKey = JSON.stringify(filters);

  useEffect(() => {
    const value = search.trim();
    if (value === filters.search) return;
    const timer = window.setTimeout(
      () => setFilters({ search: value, page: 1 }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search, filters.search]);

  useEffect(() => {
    const controller = new AbortController();
    const query = JSON.parse(queryKey);
    setList({ ...initialList, key: queryKey });
    studentsApi
      .list(query, { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const collection = normalizeStudentsList(payload, query.page);
        setList({ ...collection, key: queryKey, loading: false, error: null });
        setTotals((previous) => ({
          students:
            collection.summary.students ??
            (!query.search ? collection.total : null) ??
            previous.students,
          classes: collection.summary.classes ?? previous.classes,
        }));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setList({
            ...initialList,
            key: queryKey,
            loading: false,
            error: getStudentError(error),
          });
      });
    return () => controller.abort();
  }, [queryKey, revision]);

  useEffect(() => {
    const controller = new AbortController();
    setClasses((previous) => ({ ...previous, loading: true, error: null }));
    studentsApi
      .getClasses({ signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted)
          setClasses({ items, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setClasses({
            items: [],
            loading: false,
            error: getStudentError(error),
          });
      });
    return () => controller.abort();
  }, [classesRevision]);

  const searchPending = search.trim() !== filters.search;
  const visible = list.key === queryKey && !searchPending ? list : initialList;
  const totalStudents = totals.students ?? initialTotal;
  const totalClasses =
    totals.classes ??
    (!classes.loading && !classes.error ? classes.items.length : null);

  function submitSearch(event) {
    event.preventDefault();
    const value = search.trim();
    if (value === filters.search && filters.page === 1)
      setRevision((previous) => previous + 1);
    else setFilters({ search: value, page: 1 });
  }

  function studentCreated(result) {
    setCreateOpen(false);
    setSuccess(result.message);
    setSearch("");
    setFilters({ search: "", page: 1 });
    setRevision((previous) => previous + 1);
    onStudentCreated?.();
  }

  // Ubah/hapus: tetap di pencarian yang sama; setelah hapus kembali ke halaman 1
  // agar tidak tertinggal di halaman yang sudah kosong.
  function studentChanged(result, { deleted = false } = {}) {
    setEditing(null);
    setSuccess(result.message);
    if (deleted) setFilters((previous) => ({ ...previous, page: 1 }));
    setRevision((previous) => previous + 1);
    // Jumlah siswa di Dashboard ikut diperbarui.
    onStudentCreated?.();
  }

  return (
    <section aria-labelledby="students-title" className="text-[#003D32]">
      <header className="rounded-[24px] bg-white px-3 pb-5 pt-2 text-center shadow-[0_3px_5px_rgba(0,0,0,0.3),inset_0_4px_2px_rgba(0,0,0,0.4)] min-[380px]:pb-8 min-[380px]:pt-4">
        <h1
          id="students-title"
          className="text-[26px] font-bold leading-tight min-[380px]:text-[32px] [text-shadow:2px_3px_4px_rgba(0,0,0,0.4)]"
        >
          Data Siswa
        </h1>
        <p className="mt-1 text-[10px] leading-snug min-[380px]:text-[11px]">
          Informasi lengkap siswa
          <br />
          sebagai bagian dari administrasi sekolah
        </p>
      </header>

      <div className="relative mx-3 -mt-4 rounded-t-[28px] rounded-b-lg border border-[#003D32] bg-[#005343] px-3 py-2 text-white min-[380px]:px-4 min-[380px]:py-3">
        <h2 className="text-[12px] font-bold leading-tight min-[380px]:text-[14px]">
          Daftar Siswa
        </h2>
        <p className="text-[9px] leading-snug min-[380px]:text-[10px]">
          Kelola seluruh informasi siswa
        </p>
        <form
          role="search"
          onSubmit={submitSearch}
          className="relative mt-1 min-[380px]:mt-2"
        >
          <label htmlFor="student-search" className="sr-only">
            Cari nama atau NIS siswa
          </label>
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1.5 text-[#003D32] min-[380px]:top-2.5"
          />
          <input
            id="student-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
            placeholder="Cari nama atau NIS siswa..."
            aria-invalid={Boolean(visible.error?.fields.search)}
            aria-describedby={
              visible.error?.fields.search ? "student-search-error" : undefined
            }
            className="h-7 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[11px] text-[#003D32] outline-none focus:ring-2 focus:ring-emerald-300 min-[380px]:h-9 min-[380px]:text-[12px]"
          />
        </form>
        {visible.error?.fields.search && (
          <p id="student-search-error" className="mt-1 text-xs text-red-100">
            {visible.error.fields.search}
          </p>
        )}
        {canManage && <button
          type="button"
          aria-label="Tambah data siswa"
          onClick={() => {
            setSuccess("");
            setCreateOpen(true);
          }}
          className="mt-1 flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-emerald-900 bg-white text-[11px] font-bold text-[#003D32] transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-[380px]:mt-1.5 min-[380px]:h-9 min-[380px]:text-[12px]"
        >
          <Plus size={14} />
          Data Siswa
        </button>}
        <dl className="mt-1 grid grid-cols-2 gap-1.5 min-[380px]:mt-1.5">
          <SummaryCount label="Total Siswa" value={totalStudents} />
          <SummaryCount label="Total Kelas" value={totalClasses} />
        </dl>
      </div>

      <div className="mx-3 mt-2 min-[380px]:mt-3">
        {success && (
          <p
            role="status"
            className="mb-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900"
          >
            {success}
          </p>
        )}
        {classes.error && (
          <RequestError
            message="Daftar kelas belum dapat dimuat."
            onRetry={() => setClassesRevision((previous) => previous + 1)}
          />
        )}
        <h2 className="mb-1.5 px-3 text-[12px] font-bold min-[380px]:mb-2 min-[380px]:text-[14px]">
          Daftar Siswa
        </h2>
        <div aria-busy={visible.loading}>
          {visible.loading ? (
            <p
              role="status"
              className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"
            >
              <LoaderCircle size={15} className="animate-spin" />
              Memuat data siswa...
            </p>
          ) : visible.error ? (
            <RequestError
              message={visible.error.message}
              onRetry={() => setRevision((previous) => previous + 1)}
            />
          ) : visible.items.length === 0 ? (
            <p
              role="status"
              className="py-8 text-center text-xs text-slate-500"
            >
              {filters.search
                ? "Tidak ada siswa yang cocok dengan pencarian."
                : "Belum ada data siswa."}
            </p>
          ) : (
            <ul className="space-y-1.5 min-[380px]:space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
              {visible.items.map((record, index) => (
                <StudentCard
                  key={`${record.id_siswa ?? record.id ?? visible.currentPage}-${index}`}
                  record={record}
                  classes={classes.items}
                  onEdit={canManage && record.id_siswa != null ? () => {
                    setSuccess("");
                    setEditing(record);
                  } : undefined}
                />
              ))}
            </ul>
          )}
        </div>
        {!visible.loading && !visible.error && visible.lastPage > 1 && (
          <nav
            aria-label="Halaman data siswa"
            className="mt-4 flex items-center justify-between gap-2 text-[11px]"
          >
            <button
              type="button"
              disabled={visible.currentPage <= 1}
              onClick={() =>
                setFilters((previous) => ({
                  ...previous,
                  page: visible.currentPage - 1,
                }))
              }
              className="rounded-md border border-emerald-900/30 px-2 py-2 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span>
              Halaman {visible.currentPage} / {visible.lastPage}
            </span>
            <button
              type="button"
              disabled={visible.currentPage >= visible.lastPage}
              onClick={() =>
                setFilters((previous) => ({
                  ...previous,
                  page: visible.currentPage + 1,
                }))
              }
              className="rounded-md border border-emerald-900/30 px-2 py-2 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </nav>
        )}
      </div>
      {canManage && createOpen && (
        <StudentModal
          classes={classes}
          onRetryClasses={() => setClassesRevision((previous) => previous + 1)}
          onClose={() => setCreateOpen(false)}
          onSaved={studentCreated}
        />
      )}
      {canManage && editing && (
        <StudentModal
          record={editing}
          classes={classes}
          onRetryClasses={() => setClassesRevision((previous) => previous + 1)}
          onClose={() => setEditing(null)}
          onSaved={(result) => studentChanged(result)}
          onDeleted={(result) => studentChanged(result, { deleted: true })}
        />
      )}
    </section>
  );
}

function SummaryCount({ label, value }) {
  return (
    <div className="rounded-lg bg-white px-2 py-0.5 text-[#003D32] min-[380px]:py-1">
      <dt className="text-[9px] leading-tight min-[380px]:text-[10px]">
        {label}
      </dt>
      <dd className="text-[12px] font-bold leading-tight min-[380px]:text-[13px]">
        {formatCount(value)}
      </dd>
    </div>
  );
}

function StudentCard({ record, classes, onEdit }) {
  const student = getStudentCard(record, classes);
  return (
    <li className="rounded-[10px] border border-[#003D32] bg-[#005343] px-3 py-1.5 text-white min-[380px]:py-2">
      <div className="flex items-start gap-2">
        <CircleUserRound
          size={36}
          fill="none"
          stroke="#005343"
          strokeWidth={1.75}
          className="h-7 w-7 shrink-0 rounded-full bg-white min-[380px]:h-9 min-[380px]:w-9"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="break-words text-[12px] font-bold leading-tight min-[380px]:text-[14px]">
            {student.name}
          </h3>
          <p className="break-all text-[9px] leading-snug min-[380px]:text-[10px]">
            {student.identifierLabel}: {student.identifier}
          </p>
        </div>
        <span
          className={`mt-0.5 max-w-[80px] shrink-0 break-words rounded-full border border-[#003D32] px-2 text-center text-[9px] leading-tight min-[380px]:px-3 min-[380px]:text-[10px] ${student.active ? "bg-[#21cc3d] text-[#002d24]" : "bg-slate-200 text-slate-900"}`}
        >
          {student.status}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/60 pt-1">
        <p className="text-[9px] leading-tight min-[380px]:text-[10px]">
          Kelas: {student.className}
        </p>
        {onEdit && (
          <button
            type="button"
            aria-label={`Edit siswa ${student.name}`}
            onClick={onEdit}
            className="flex shrink-0 items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-[#003D32] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <Pencil size={11} aria-hidden="true" />
            Edit
          </button>
        )}
      </div>
    </li>
  );
}

function RequestError({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <p className="flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex shrink-0 items-center gap-1 rounded p-1 hover:bg-amber-100"
      >
        <RefreshCw size={13} />
        Coba lagi
      </button>
    </div>
  );
}

function fieldText(value) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

/** Form tambah siswa, atau ubah + hapus bila `record` diberikan (khusus guru). */
function StudentModal({ record = null, classes, onRetryClasses, onClose, onSaved, onDeleted }) {
  const editing = record !== null;
  // Backend mengirim has_account; data lama tanpa penanda dianggap berakun bila id_user terisi.
  const hasAccount = editing && (typeof record.has_account === "boolean"
    ? record.has_account
    : fieldText(record.id_user).trim() !== "");
  const prefix = editing ? "edit-student" : "create-student";
  const [values, setValues] = useState(() => editing ? {
    nama_siswa: fieldText(record.nama_siswa),
    nis: fieldText(record.nis),
    id_kelas: fieldText(record.id_kelas),
    sn: fieldText(record.sn),
    status: fieldText(record.status).toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  } : { nama_siswa: "", nis: "", id_kelas: "", sn: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = useRef(null);
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("input")?.focus();
    function handleKey(event) {
      if (event.key === "Escape" && !pending.current) {
        event.preventDefault();
        close.current();
      }
      if (event.key === "Tab") {
        const focusable = [
          ...dialog.current.querySelectorAll(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
          ),
        ];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first) {
          event.preventDefault();
          dialog.current.focus();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      pending.current?.abort();
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  async function run(task, onDone, action) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSubmitting(true);
    setError(null);
    try {
      const result = await task(controller.signal);
      if (controller.signal.aborted) return;
      pending.current = null;
      setSubmitting(false);
      onDone(result);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        pending.current = null;
        setSubmitting(false);
        setConfirmDelete(false);
        setError(getStudentError(requestError, action));
      }
    }
  }

  function submit(event) {
    event.preventDefault();
    run(
      (signal) => editing
        ? studentsApi.update(record.id_siswa, values, { signal })
        : studentsApi.create(values, { signal }),
      onSaved,
      editing ? "update" : "save",
    );
  }

  function remove() {
    run((signal) => studentsApi.remove(record.id_siswa, { signal }), onDeleted, "delete");
  }

  const textFields = [
    { name: "nama_siswa", label: "Nama siswa", autoComplete: "name", required: true },
    { name: "nis", label: "NIS", autoComplete: "off", required: true },
    {
      name: "sn",
      label: hasAccount ? "Nomor kartu (SN)" : "Nomor kartu (SN, opsional)",
      autoComplete: "off",
      required: hasAccount,
      hint: hasAccount ? "Dipakai untuk absensi dan Lupa password akun siswa ini." : undefined,
    },
  ];
  const title = editing ? "Edit Data Siswa" : "Tambah Data Siswa";

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending.current) onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${prefix}-title`}
        tabIndex={-1}
        className="max-h-[calc(100dvh-32px)] w-full max-w-[398px] overflow-y-auto rounded-2xl bg-white p-5 text-[#003D32] shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id={`${prefix}-title`} className="text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label={editing ? "Tutup form edit siswa" : "Tutup form tambah siswa"}
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-emerald-50 disabled:opacity-40"
          >
            <X size={22} />
          </button>
        </div>
        {editing && (
          <p className="-mt-3 mb-4 text-xs text-slate-600">
            {hasAccount ? "Siswa ini sudah punya akun login. Nama dan nomor kartu di akun ikut diperbarui." : "Siswa ini belum punya akun login."}
          </p>
        )}
        <form onSubmit={submit} aria-busy={submitting}>
          <fieldset disabled={submitting} className="space-y-4">
            {textFields.map(({ name, label, autoComplete, required, hint }) => (
              <div key={name}>
                <label
                  htmlFor={`${prefix}-${name}`}
                  className="mb-1 block text-xs font-semibold"
                >
                  {label}
                </label>
                <input
                  id={`${prefix}-${name}`}
                  name={name}
                  type="text"
                  required={required}
                  autoComplete={autoComplete}
                  value={values[name]}
                  onChange={(event) =>
                    setValues((previous) => ({
                      ...previous,
                      [name]: event.target.value,
                    }))
                  }
                  aria-invalid={Boolean(error?.fields[name])}
                  aria-describedby={
                    error?.fields[name]
                      ? `${prefix}-${name}-error`
                      : hint ? `${prefix}-${name}-hint` : undefined
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                />
                {error?.fields[name] ? (
                  <p
                    id={`${prefix}-${name}-error`}
                    className="mt-1 text-xs text-red-700"
                  >
                    {error.fields[name]}
                  </p>
                ) : hint ? (
                  <p id={`${prefix}-${name}-hint`} className="mt-1 text-[11px] text-slate-500">{hint}</p>
                ) : null}
              </div>
            ))}
            <div>
              <label
                htmlFor={`${prefix}-id_kelas`}
                className="mb-1 block text-xs font-semibold"
              >
                Kelas
              </label>
              <select
                id={`${prefix}-id_kelas`}
                name="id_kelas"
                required
                disabled={classes.loading || classes.items.length === 0}
                value={values.id_kelas}
                onChange={(event) =>
                  setValues((previous) => ({
                    ...previous,
                    id_kelas: event.target.value,
                  }))
                }
                aria-invalid={Boolean(error?.fields.id_kelas)}
                aria-describedby={
                  error?.fields.id_kelas
                    ? `${prefix}-id_kelas-error`
                    : undefined
                }
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:opacity-50"
              >
                <option value="">
                  {classes.loading ? "Memuat kelas..." : "Pilih kelas"}
                </option>
                {classes.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {error?.fields.id_kelas && (
                <p
                  id={`${prefix}-id_kelas-error`}
                  className="mt-1 text-xs text-red-700"
                >
                  {error.fields.id_kelas}
                </p>
              )}
            </div>
            {editing && (
              <div>
                <label htmlFor={`${prefix}-status`} className="mb-1 block text-xs font-semibold">
                  Status
                </label>
                <select
                  id={`${prefix}-status`}
                  name="status"
                  value={values.status}
                  onChange={(event) => setValues((previous) => ({ ...previous, status: event.target.value }))}
                  aria-invalid={Boolean(error?.fields.status)}
                  aria-describedby={`${prefix}-status-hint`}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                >
                  {STUDENT_STATUSES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
                <p id={`${prefix}-status-hint`} className="mt-1 text-[11px] text-slate-500">
                  {error?.fields.status || "Siswa nonaktif (lulus/pindah) tidak bisa melakukan absensi."}
                </p>
              </div>
            )}
          </fieldset>
          {classes.error && (
            <div className="mt-3">
              <RequestError
                message="Daftar kelas belum dapat dimuat."
                onRetry={onRetryClasses}
              />
            </div>
          )}
          {!classes.loading && !classes.error && !classes.items.length && (
            <p className="mt-3 text-xs text-amber-800">
              Belum ada kelas yang dapat dipilih. Hubungi pengelola sekolah.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-800"
            >
              {error.message}
            </p>
          )}
          {confirmDelete ? (
            <div
              role="alertdialog"
              aria-labelledby={`${prefix}-delete-title`}
              className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900"
            >
              <p id={`${prefix}-delete-title`} className="text-sm font-semibold">
                Hapus siswa "{fieldText(record?.nama_siswa)}"?
              </p>
              <p className="mt-1 text-xs">
                {hasAccount
                  ? "Akun login siswa ini juga akan dihapus. Siswa yang sudah punya riwayat absensi tidak dapat dihapus; ubah statusnya menjadi Nonaktif."
                  : "Data yang dihapus tidak dapat dikembalikan."}
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-red-900/30 bg-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  Tidak
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={remove}
                  className="flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {submitting && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}
                  {submitting ? "Menghapus..." : "Ya, hapus"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-end gap-2">
              {editing && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setError(null);
                    setConfirmDelete(true);
                  }}
                  className="mr-auto flex items-center gap-1 rounded-lg border border-red-700 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Hapus
                </button>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="rounded-lg border border-emerald-900/30 px-4 py-2 text-sm disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || classes.loading || !classes.items.length}
                className="flex items-center gap-2 rounded-lg bg-[#005343] px-4 py-2 text-sm text-white hover:bg-[#003D32] disabled:opacity-50"
              >
                {submitting && (
                  <LoaderCircle size={15} className="animate-spin" />
                )}
                {submitting ? "Menyimpan..." : editing ? "Simpan perubahan" : "Simpan siswa"}
              </button>
            </div>
          )}
        </form>
      </section>
    </div>,
    document.body,
  );
}

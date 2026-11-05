import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CircleUserRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { teachersApi, getTeacherError } from "../../services/teachers.js";
import { getTeacherCard, normalizeTeachersList } from "./teacherData.js";

const initialList = {
  items: [],
  loading: true,
  error: null,
  currentPage: 1,
  lastPage: 1,
  key: "",
};

export default function Teachers({ onTeacherCreated, canManage = false }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ search: "", page: 1 });
  const [list, setList] = useState(initialList);
  const [revision, setRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
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
    teachersApi
      .list(query, { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const collection = normalizeTeachersList(payload, query.page);
        setList({ ...collection, key: queryKey, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setList({
            ...initialList,
            key: queryKey,
            loading: false,
            error: getTeacherError(error),
          });
      });
    return () => controller.abort();
  }, [queryKey, revision]);

  const visible =
    list.key === queryKey && search.trim() === filters.search
      ? list
      : initialList;

  function submitSearch(event) {
    event.preventDefault();
    const value = search.trim();
    if (value === filters.search && filters.page === 1)
      setRevision((previous) => previous + 1);
    else setFilters({ search: value, page: 1 });
  }

  function teacherCreated(result) {
    setCreateOpen(false);
    setSuccess(result.message);
    setSearch("");
    setFilters({ search: "", page: 1 });
    setRevision((previous) => previous + 1);
    onTeacherCreated?.();
  }

  return (
    <section aria-labelledby="teachers-title" className="text-[#003D32]">
      <header className="rounded-[24px] bg-white px-3 pb-5 pt-2 text-center shadow-[0_3px_5px_rgba(0,0,0,0.3),inset_0_4px_2px_rgba(0,0,0,0.4)] min-[380px]:pb-8 min-[380px]:pt-4">
        <h1
          id="teachers-title"
          className="text-[26px] font-bold leading-tight min-[380px]:text-[32px] [text-shadow:2px_3px_4px_rgba(0,0,0,0.4)]"
        >
          Data Guru
        </h1>
        <p className="mt-1 text-[10px] leading-snug min-[380px]:text-[11px]">
          Informasi tenaga pendidik
          <br />
          untuk mendukung pengelolaan kegiatan belajar mengajar
        </p>
      </header>

      <div className="relative mx-3 -mt-4 rounded-t-[28px] rounded-b-lg border border-[#003D32] bg-[#005343] px-3 py-2 text-white min-[380px]:px-4 min-[380px]:py-3">
        <h2 className="text-[12px] font-bold leading-tight min-[380px]:text-[14px]">
          Daftar Guru
        </h2>
        <p className="text-[9px] leading-snug min-[380px]:text-[10px]">
          Informasi seluruh tenaga pengajar
        </p>
        <form
          role="search"
          onSubmit={submitSearch}
          className="relative mt-1 min-[380px]:mt-2"
        >
          <label htmlFor="teacher-search" className="sr-only">
            Cari nama atau NIP guru
          </label>
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1.5 text-[#003D32] min-[380px]:top-2.5"
          />
          <input
            id="teacher-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
            placeholder="Cari nama atau NIP guru..."
            aria-invalid={Boolean(visible.error?.fields.search)}
            aria-describedby={
              visible.error?.fields.search ? "teacher-search-error" : undefined
            }
            className="h-7 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[11px] text-[#003D32] outline-none focus:ring-2 focus:ring-emerald-300 min-[380px]:h-9 min-[380px]:text-[12px]"
          />
        </form>
        {visible.error?.fields.search && (
          <p id="teacher-search-error" className="mt-1 text-xs text-red-100">
            {visible.error.fields.search}
          </p>
        )}
        {canManage && <button
          type="button"
          aria-label="Tambah data guru"
          onClick={() => {
            setSuccess("");
            setCreateOpen(true);
          }}
          className="mt-1 flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-emerald-900 bg-white text-[11px] font-bold text-[#003D32] transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-[380px]:mt-1.5 min-[380px]:h-9 min-[380px]:text-[12px]"
        >
          <Plus size={14} />
          Data Guru
        </button>}
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
        <div aria-busy={visible.loading}>
          {visible.loading ? (
            <p
              role="status"
              className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"
            >
              <LoaderCircle size={15} className="animate-spin" />
              Memuat data guru...
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
                ? "Tidak ada guru yang cocok dengan pencarian."
                : "Belum ada data guru."}
            </p>
          ) : (
            <ul
              aria-label="Daftar guru"
              className="space-y-1 min-[380px]:space-y-1.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3"
            >
              {visible.items.map((record, index) => (
                <TeacherCard
                  key={`${record.id_guru ?? record.id ?? visible.currentPage}-${index}`}
                  record={record}
                />
              ))}
            </ul>
          )}
        </div>
        {!visible.loading && !visible.error && visible.lastPage > 1 && (
          <nav
            aria-label="Halaman data guru"
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
        <CreateTeacherModal
          onClose={() => setCreateOpen(false)}
          onCreated={teacherCreated}
        />
      )}
    </section>
  );
}

function TeacherCard({ record }) {
  const teacher = getTeacherCard(record);
  return (
    <li className="rounded-[10px] border border-[#003D32] bg-[#005343] px-3 py-1.5 text-white min-[380px]:py-2">
      <div className="flex items-start gap-2">
        <CircleUserRound
          size={32}
          fill="none"
          stroke="#005343"
          strokeWidth={1.75}
          className="h-7 w-7 shrink-0 rounded-full bg-white min-[380px]:h-8 min-[380px]:w-8"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="break-words text-[12px] font-bold leading-tight min-[380px]:text-[13px]">
            {teacher.name}
          </h3>
          <p className="break-all text-[9px] leading-snug min-[380px]:text-[10px]">
            {teacher.identifierLabel}: {teacher.identifier}
          </p>
        </div>
        <span
          className={`mt-0.5 max-w-[80px] shrink-0 break-words rounded-full border border-[#003D32] px-2 text-center text-[9px] leading-tight min-[380px]:px-3 min-[380px]:text-[10px] ${teacher.active ? "bg-[#21cc3d] text-[#002d24]" : "bg-slate-200 text-slate-900"}`}
        >
          {teacher.status}
        </span>
      </div>
      <p className="mt-1 border-t border-white/60 pt-1 text-[9px] leading-tight min-[380px]:text-[10px]">
        Mata Pelajaran: {teacher.subject}
      </p>
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

const formFields = [
  { name: "nama", label: "Nama guru", autoComplete: "name" },
  { name: "nip", label: "NIP", autoComplete: "off" },
  { name: "mata_pelajaran", label: "Mata pelajaran", autoComplete: "off" },
  { name: "sn", label: "Nomor kartu (SN, opsional)", autoComplete: "off" },
];

function CreateTeacherModal({ onClose, onCreated }) {
  const [values, setValues] = useState({
    nama: "",
    nip: "",
    mata_pelajaran: "",
    sn: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
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
      if (event.key === "Escape") {
        event.preventDefault();
        if (!pending.current) close.current();
      }
      if (event.key === "Tab") {
        const focusable = [
          ...dialog.current.querySelectorAll(
            "button:not(:disabled), input:not(:disabled)",
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
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
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

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSubmitting(true);
    setError(null);
    try {
      const result = await teachersApi.create(values, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      pending.current = null;
      setSubmitting(false);
      onCreated(result);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        pending.current = null;
        setSubmitting(false);
        setError(getTeacherError(requestError, "save"));
      }
    }
  }

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
        aria-labelledby="create-teacher-title"
        tabIndex={-1}
        className="max-h-[calc(100dvh-32px)] w-full max-w-[398px] overflow-y-auto rounded-2xl bg-white p-5 text-[#003D32] shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="create-teacher-title" className="text-xl font-bold">
            Tambah Data Guru
          </h2>
          <button
            type="button"
            aria-label="Tutup form tambah guru"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-emerald-50 disabled:opacity-40"
          >
            <X size={22} />
          </button>
        </div>
        <form onSubmit={submit} aria-busy={submitting}>
          <fieldset disabled={submitting} className="space-y-4">
            {formFields.map(({ name, label, autoComplete }) => (
              <div key={name}>
                <label
                  htmlFor={`create-teacher-${name}`}
                  className="mb-1 block text-xs font-semibold"
                >
                  {label}
                </label>
                <input
                  id={`create-teacher-${name}`}
                  name={name}
                  type="text"
                  required={name !== "sn"}
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
                      ? `create-teacher-${name}-error`
                      : undefined
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                />
                {error?.fields[name] && (
                  <p
                    id={`create-teacher-${name}-error`}
                    className="mt-1 text-xs text-red-700"
                  >
                    {error.fields[name]}
                  </p>
                )}
              </div>
            ))}
          </fieldset>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-800"
            >
              {error.message}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
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
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-[#005343] px-4 py-2 text-sm text-white hover:bg-[#003D32] disabled:opacity-50"
            >
              {submitting && (
                <LoaderCircle size={15} className="animate-spin" />
              )}
              {submitting ? "Menyimpan..." : "Simpan guru"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

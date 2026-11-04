import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ContactRound,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import {
  classesApi,
  getClassError,
  getClassView,
} from "../../services/classes.js";

const initialList = {
  items: [],
  loading: true,
  error: null,
  currentPage: 1,
  lastPage: 1,
  key: "",
};
const countLabel = (count) =>
  count == null ? "— Siswa" : `${count.toLocaleString("id-ID")} Siswa`;
const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20";

export default function Classes({ canManage = false }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ search: "", page: 1 });
  const [list, setList] = useState(initialList);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [success, setSuccess] = useState("");
  const queryKey = JSON.stringify(filters);

  useEffect(() => {
    if (search.trim() === filters.search) return;
    const timer = window.setTimeout(
      () => setFilters({ search: search.trim(), page: 1 }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search, filters.search]);

  useEffect(() => {
    const controller = new AbortController();
    setList({ ...initialList, key: queryKey });
    classesApi
      .list(JSON.parse(queryKey), { signal: controller.signal })
      .then((collection) => {
        if (!controller.signal.aborted)
          setList({
            ...collection,
            loading: false,
            error: null,
            key: queryKey,
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setList({
            ...initialList,
            loading: false,
            error: getClassError(error),
            key: queryKey,
          });
      });
    return () => controller.abort();
  }, [queryKey, revision]);

  const visible =
    list.key === queryKey && search.trim() === filters.search
      ? list
      : initialList;
  function open(mode, id) {
    if (mode !== "detail" && !canManage) return;
    setSuccess("");
    setDialog({ mode, id });
  }
  function saved(result, created) {
    setDialog(null);
    setSuccess(result.message);
    if (created) {
      setSearch("");
      setFilters({ search: "", page: 1 });
    }
    setRevision((value) => value + 1);
  }
  function submitSearch(event) {
    event.preventDefault();
    if (search.trim() === filters.search && filters.page === 1)
      setRevision((value) => value + 1);
    else setFilters({ search: search.trim(), page: 1 });
  }

  return (
    <section aria-labelledby="classes-title" className="text-[#003D32]">
      <header className="rounded-[24px] bg-white px-3 pb-7 pt-3 text-center shadow-[0_3px_5px_rgba(0,0,0,0.3),inset_0_4px_2px_rgba(0,0,0,0.4)] min-[380px]:pb-8 min-[380px]:pt-4">
        <h1
          id="classes-title"
          className="text-[26px] font-bold leading-tight [text-shadow:2px_3px_4px_rgba(0,0,0,0.4)] min-[380px]:text-[32px]"
        >
          Data Kelas
        </h1>
        <p className="text-[10px] min-[380px]:text-[11px]">Informasi Kelas</p>
      </header>
      <div className="relative mx-3 -mt-4 rounded-t-[28px] rounded-b-lg border border-[#003D32] bg-[#005343] px-3 pb-3 pt-7 min-[380px]:px-4 min-[380px]:pt-8">
        <form role="search" onSubmit={submitSearch} className="relative">
          <label htmlFor="class-search" className="sr-only">
            Cari nama kelas
          </label>
          <Search
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-2.5"
          />
          <input
            id="class-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
            placeholder="Cari Nama Kelas..."
            aria-invalid={Boolean(visible.error?.fields.search)}
            aria-describedby={
              visible.error?.fields.search ? "class-search-error" : undefined
            }
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[11px] outline-none focus:ring-2 focus:ring-emerald-300 min-[380px]:text-xs"
          />
        </form>
        {visible.error?.fields.search && (
          <p id="class-search-error" className="mt-1 text-xs text-red-100">
            {visible.error.fields.search}
          </p>
        )}
        {canManage && <button
          type="button"
          aria-label="Tambah data kelas"
          onClick={() => open("create")}
          className="mt-1 flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-emerald-900 bg-white text-[11px] font-semibold hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-[380px]:text-xs"
        >
          Tambah Data Kelas <Plus size={12} aria-hidden="true" />
        </button>}
      </div>
      <div className="mx-3 mt-2">
        {success && (
          <p
            role="status"
            className="mb-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900"
          >
            {success}
          </p>
        )}
        <div aria-busy={visible.loading}>
          {visible.loading ? (
            <Loading label="Memuat data kelas..." />
          ) : visible.error ? (
            <RequestError
              message={visible.error.message}
              onRetry={() => setRevision((value) => value + 1)}
            />
          ) : !visible.items.length ? (
            <p
              role="status"
              className="py-8 text-center text-xs text-slate-500"
            >
              {filters.search
                ? "Tidak ada kelas yang cocok dengan pencarian."
                : "Belum ada data kelas."}
            </p>
          ) : (
            <ul aria-label="Daftar kelas" className="space-y-2">
              {visible.items.map((record) => {
                const item = getClassView(record);
                return (
                  <ClassCard
                    key={item.id}
                    item={item}
                    onDetail={() => open("detail", item.id)}
                    onEdit={canManage ? () => open("edit", item.id) : undefined}
                  />
                );
              })}
            </ul>
          )}
        </div>
        {!visible.loading && !visible.error && visible.lastPage > 1 && (
          <nav
            aria-label="Halaman data kelas"
            className="mt-4 flex items-center justify-between gap-2 text-[11px]"
          >
            <button
              type="button"
              disabled={visible.currentPage <= 1}
              onClick={() =>
                setFilters((value) => ({
                  ...value,
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
                setFilters((value) => ({
                  ...value,
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
      {dialog && (canManage || dialog.mode === "detail") && (
        <ClassModal
          canManage={canManage}
          initialMode={dialog.mode}
          id={dialog.id}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </section>
  );
}

function ClassCard({ item, onDetail, onEdit }) {
  return (
    <li className="rounded-lg border border-[#003D32] bg-[#005343] px-3 py-2 text-white min-[380px]:px-4 min-[380px]:py-3">
      <div className="flex items-start gap-2">
        <Presentation
          size={27}
          strokeWidth={2}
          aria-hidden="true"
          className="mt-0.5 shrink-0 min-[380px]:h-8 min-[380px]:w-8"
        />
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-[13px] font-bold min-[380px]:text-[14px]">
            {item.name}
          </h2>
          <p className="flex items-center gap-1 text-[10px] min-[380px]:text-[11px]">
            <UsersRound size={11} aria-hidden="true" />
            {countLabel(item.studentCount)}
          </p>
          <p className="flex items-start gap-1 text-[10px] leading-snug min-[380px]:text-[11px]">
            <ContactRound
              size={11}
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            />
            <span className="break-words">Wali Kelas : {item.teacherName}</span>
          </p>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-3 pl-9 min-[380px]:pl-10">
        <button
          type="button"
          aria-label={`Detail kelas ${item.name}`}
          onClick={onDetail}
          className="flex min-h-7 items-center justify-center gap-1 rounded bg-white px-2 text-[11px] font-semibold text-[#003D32] hover:bg-emerald-50"
        >
          <Eye size={14} aria-hidden="true" />
          Detail
        </button>
        {onEdit && <button
          type="button"
          aria-label={`Edit kelas ${item.name}`}
          onClick={onEdit}
          className="flex min-h-7 items-center justify-center gap-1 rounded bg-white px-2 text-[11px] font-semibold text-[#003D32] hover:bg-emerald-50"
        >
          <Pencil size={13} aria-hidden="true" />
          Edit
        </button>}
      </div>
    </li>
  );
}

function Loading({ label }) {
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"
    >
      <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
      {label}
    </p>
  );
}

function RequestError({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 flex items-center gap-1 rounded p-1 font-semibold hover:bg-amber-100"
      >
        <RefreshCw size={13} aria-hidden="true" />
        Coba lagi
      </button>
    </div>
  );
}

function ClassModal({ initialMode, id, onClose, onSaved, canManage = false }) {
  const [mode, setMode] = useState(initialMode);
  const [record, setRecord] = useState(null);
  const [values, setValues] = useState({ nama_kelas: "", id_wali_kelas: "" });
  const [detail, setDetail] = useState({ loading: Boolean(id), error: null });
  const [teachers, setTeachers] = useState({
    items: [],
    loading: true,
    error: null,
  });
  const [detailRevision, setDetailRevision] = useState(0);
  const [teacherRevision, setTeacherRevision] = useState(0);
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
    dialog.current.focus();
    function handleKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!pending.current) close.current();
      }
      if (event.key === "Tab") {
        const elements = [
          ...dialog.current.querySelectorAll(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
          ),
        ].filter((element) => !element.matches(":disabled"));
        const first = elements[0],
          last = elements.at(-1);
        if (!first) {
          event.preventDefault();
          dialog.current.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === dialog.current)
        ) {
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

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setDetail({ loading: true, error: null });
    classesApi
      .detail(id, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const item = getClassView(result.record);
        setRecord(result.record);
        setValues({ nama_kelas: item.name, id_wali_kelas: item.teacherId });
        setDetail({ loading: false, error: null });
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setDetail({ loading: false, error: getClassError(requestError) });
      });
    return () => controller.abort();
  }, [id, detailRevision]);

  const editing = mode !== "detail";
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    setTeachers({ items: [], loading: true, error: null });
    classesApi
      .getTeachers({ signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted)
          setTeachers({ items, loading: false, error: null });
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setTeachers({
            items: [],
            loading: false,
            error: getClassError(requestError),
          });
      });
    return () => controller.abort();
  }, [editing, teacherRevision]);

  useEffect(() => {
    if (editing && !detail.loading && !detail.error)
      dialog.current?.querySelector("input")?.focus();
  }, [editing, detail.loading, detail.error]);

  const current = record ? getClassView(record) : null;
  const missingTeacherId =
    current?.teacherName !== "—" && current?.teacherName && !current.teacherId;
  const teacherItems = [...teachers.items];
  if (
    current?.teacherId &&
    !teacherItems.some((item) => item.id === current.teacherId)
  ) {
    teacherItems.push({
      id: current.teacherId,
      name:
        current.teacherName === "—"
          ? "Wali kelas saat ini"
          : current.teacherName,
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!canManage) return;
    if (
      pending.current ||
      detail.loading ||
      detail.error ||
      teachers.loading ||
      teachers.error
    )
      return;
    if (missingTeacherId && !values.id_wali_kelas) {
      setError({
        message:
          "Pilih kembali wali kelas agar data penugasan tetap tersimpan.",
        fields: { id_wali_kelas: "Pilih wali kelas." },
      });
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setSubmitting(true);
    setError(null);
    try {
      const result =
        mode === "create"
          ? await classesApi.create(values, { signal: controller.signal })
          : await classesApi.update(id, values, { signal: controller.signal });
      if (controller.signal.aborted) return;
      pending.current = null;
      setSubmitting(false);
      onSaved(result, mode === "create");
    } catch (requestError) {
      if (!controller.signal.aborted) {
        pending.current = null;
        setSubmitting(false);
        setError(getClassError(requestError, "save"));
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
        aria-labelledby="class-dialog-title"
        tabIndex={-1}
        className="max-h-[calc(100dvh-32px)] w-full max-w-[398px] overflow-y-auto rounded-2xl bg-white p-5 text-[#003D32] shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="class-dialog-title" className="text-xl font-bold">
            {mode === "create"
              ? "Tambah Data Kelas"
              : mode === "edit"
                ? "Edit Data Kelas"
                : "Detail Kelas"}
          </h2>
          <button
            type="button"
            aria-label="Tutup data kelas"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-emerald-50 disabled:opacity-40"
          >
            <X size={22} />
          </button>
        </div>
        {detail.loading ? (
          <Loading label="Memuat detail kelas..." />
        ) : detail.error ? (
          <RequestError
            message={detail.error.message}
            onRetry={() => setDetailRevision((value) => value + 1)}
          />
        ) : !editing && current ? (
          <>
            <div className="mb-5 rounded-xl bg-[#005343] p-4 text-white">
              <Presentation size={30} aria-hidden="true" />
              <h3 className="mt-2 break-words text-2xl font-bold">
                {current.name}
              </h3>
            </div>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Jumlah siswa</dt>
                <dd className="font-semibold">
                  {countLabel(current.studentCount)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Wali kelas</dt>
                <dd className="break-words font-semibold">
                  {current.teacherName}
                </dd>
              </div>
            </dl>
            {canManage && <button
              type="button"
              onClick={() => setMode("edit")}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#005343] px-4 py-3 text-sm text-white hover:bg-[#003D32]"
            >
              <Pencil size={15} aria-hidden="true" />
              Edit kelas
            </button>}
          </>
        ) : (
          <form onSubmit={submit} aria-busy={submitting}>
            <fieldset disabled={submitting} className="space-y-4">
              <div>
                <label
                  htmlFor="class-nama_kelas"
                  className="mb-1 block text-xs font-semibold"
                >
                  Nama kelas
                </label>
                <input
                  id="class-nama_kelas"
                  name="nama_kelas"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Contoh: X AKL"
                  value={values.nama_kelas}
                  onChange={(event) =>
                    setValues((value) => ({
                      ...value,
                      nama_kelas: event.target.value,
                    }))
                  }
                  aria-invalid={Boolean(error?.fields.nama_kelas)}
                  aria-describedby={
                    error?.fields.nama_kelas
                      ? "class-nama_kelas-error"
                      : undefined
                  }
                  className={inputClass}
                />
                <FieldError name="nama_kelas" error={error} />
              </div>
              <div>
                <label
                  htmlFor="class-id_wali_kelas"
                  className="mb-1 block text-xs font-semibold"
                >
                  Wali kelas (opsional)
                </label>
                <select
                  id="class-id_wali_kelas"
                  name="id_wali_kelas"
                  disabled={teachers.loading || Boolean(teachers.error)}
                  value={values.id_wali_kelas}
                  onChange={(event) =>
                    setValues((value) => ({
                      ...value,
                      id_wali_kelas: event.target.value,
                    }))
                  }
                  aria-invalid={Boolean(error?.fields.id_wali_kelas)}
                  aria-describedby={
                    error?.fields.id_wali_kelas
                      ? "class-id_wali_kelas-error"
                      : undefined
                  }
                  className={inputClass}
                >
                  <option value="">
                    {teachers.loading ? "Memuat guru..." : "Belum ditentukan"}
                  </option>
                  {teacherItems.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                <FieldError name="id_wali_kelas" error={error} />
                {teachers.error && (
                  <div className="mt-2">
                    <RequestError
                      message={teachers.error.message}
                      onRetry={() => setTeacherRevision((value) => value + 1)}
                    />
                  </div>
                )}
                {!teachers.loading &&
                  !teachers.error &&
                  !teachers.items.length && (
                    <p className="mt-1 text-xs text-slate-500">
                      Belum ada guru. Wali kelas dapat ditentukan setelah data
                      guru ditambahkan.
                    </p>
                  )}
              </div>
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
                disabled={
                  submitting || teachers.loading || Boolean(teachers.error)
                }
                className="flex items-center gap-2 rounded-lg bg-[#005343] px-4 py-2 text-sm text-white hover:bg-[#003D32] disabled:opacity-50"
              >
                {submitting && (
                  <LoaderCircle
                    size={15}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}
                {submitting ? "Menyimpan..." : "Simpan kelas"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}

function FieldError({ name, error }) {
  return error?.fields[name] ? (
    <p id={`class-${name}-error`} className="mt-1 text-xs text-red-700">
      {error.fields[name]}
    </p>
  ) : null;
}

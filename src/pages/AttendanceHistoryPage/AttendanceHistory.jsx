import { useEffect, useState } from "react";
import { ChevronDown, LoaderCircle, RefreshCw } from "lucide-react";
import {
  attendanceHistoryApi,
  getHistoryError,
  getHistoryRow,
  getJakartaDate,
  isValidHistoryDate,
} from "../../services/attendanceHistory.js";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const initialHistory = {
  items: [],
  loading: true,
  error: null,
  currentPage: 1,
  lastPage: 1,
  offset: 0,
  key: "",
};

export default function AttendanceHistory() {
  const [filters, setFilters] = useState(() => ({
    id_kelas: "",
    tanggal: getJakartaDate(),
    page: 1,
  }));
  const [classes, setClasses] = useState({
    items: [],
    loading: true,
    error: null,
  });
  const [history, setHistory] = useState(initialHistory);
  const [classesRevision, setClassesRevision] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const queryKey = JSON.stringify(filters);

  useEffect(() => {
    const controller = new AbortController();
    setClasses((previous) => ({ ...previous, loading: true, error: null }));
    attendanceHistoryApi
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
            error: getHistoryError(error, "Daftar kelas"),
          });
      });
    return () => controller.abort();
  }, [classesRevision]);

  useEffect(() => {
    const controller = new AbortController();
    setHistory({ ...initialHistory, key: queryKey });
    attendanceHistoryApi
      .getHistory(JSON.parse(queryKey), { signal: controller.signal })
      .then((collection) => {
        if (!controller.signal.aborted)
          setHistory({
            ...collection,
            key: queryKey,
            loading: false,
            error: null,
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setHistory({
            ...initialHistory,
            key: queryKey,
            loading: false,
            error: getHistoryError(error),
          });
      });
    return () => controller.abort();
  }, [queryKey, historyRevision]);

  const visible = history.key === queryKey ? history : initialHistory;
  const dateLabel = dateFormat.format(
    new Date(`${filters.tanggal}T12:00:00+07:00`),
  );

  function changeFilter(field, value) {
    setFilters((previous) => ({ ...previous, [field]: value, page: 1 }));
  }

  return (
    <section
      aria-labelledby="attendance-history-title"
      className="text-[#003D32]"
    >
      <header className="rounded-[24px] bg-white px-2 pb-4 pt-5 text-center shadow-[0_3px_5px_rgba(0,0,0,0.3),inset_0_4px_2px_rgba(0,0,0,0.4)] min-[380px]:px-4">
        <p className="text-[10px]">
          <time dateTime={filters.tanggal}>{dateLabel}</time>
        </p>
        <h1
          id="attendance-history-title"
          className="text-[25px] font-bold leading-tight tracking-tight min-[380px]:text-[30px] [text-shadow:2px_3px_4px_rgba(0,0,0,0.4)]"
        >
          Riwayat Absensi
        </h1>
        <p className="mt-1 text-[10px] leading-snug min-[380px]:text-[11px]">
          Pantau riwayat kehadiran
          <br />
          dan lihat catatan absensi Anda secara lengkap
        </p>
      </header>

      <div className="grid grid-cols-2 gap-5 px-6 pb-3 pt-4">
        <div>
          <label
            htmlFor="history-class"
            className="mb-1 block text-[14px] font-bold"
          >
            Kelas
          </label>
          <div className="relative">
            <select
              id="history-class"
              value={filters.id_kelas}
              disabled={classes.loading || classes.items.length === 0}
              onChange={(event) => changeFilter("id_kelas", event.target.value)}
              aria-invalid={Boolean(visible.error?.fields.id_kelas)}
              aria-describedby={
                visible.error?.fields.id_kelas
                  ? "history-class-error"
                  : undefined
              }
              className="h-8 w-full appearance-none rounded-md border border-slate-300 bg-white pl-2 pr-6 text-[13px] font-semibold text-[#003D32] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:opacity-60"
            >
              <option value="">
                {classes.loading ? "Memuat kelas..." : "Semua kelas"}
              </option>
              {classes.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-2.5"
            />
          </div>
          {visible.error?.fields.id_kelas && (
            <p id="history-class-error" className="mt-1 text-xs text-red-700">
              {visible.error.fields.id_kelas}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="history-date"
            className="mb-1 block text-[14px] font-bold"
          >
            Tanggal
          </label>
          <input
            id="history-date"
            type="date"
            lang="id-ID"
            required
            value={filters.tanggal}
            onChange={(event) => {
              if (isValidHistoryDate(event.target.value))
                changeFilter("tanggal", event.target.value);
            }}
            aria-invalid={Boolean(visible.error?.fields.tanggal)}
            aria-describedby={
              visible.error?.fields.tanggal ? "history-date-error" : undefined
            }
            className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-[12px] font-semibold text-[#003D32] outline-none [color-scheme:light] focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
          />
          {visible.error?.fields.tanggal && (
            <p id="history-date-error" className="mt-1 text-xs text-red-700">
              {visible.error.fields.tanggal}
            </p>
          )}
        </div>
      </div>

      <div className="px-3">
        {classes.error && (
          <RequestError
            error={classes.error}
            onRetry={() => setClassesRevision((value) => value + 1)}
          />
        )}
        {!classes.loading && !classes.error && classes.items.length === 0 && (
          <p className="px-3 pb-2 text-xs text-slate-500">
            Belum ada data kelas.
          </p>
        )}
        {visible.loading ? (
          <p
            role="status"
            className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"
          >
            <LoaderCircle size={15} className="animate-spin" />
            Memuat riwayat absensi...
          </p>
        ) : visible.error ? (
          <RequestError
            error={visible.error}
            onRetry={() => setHistoryRevision((value) => value + 1)}
          />
        ) : visible.items.length === 0 ? (
          <p
            role="status"
            className="px-3 py-8 text-center text-xs text-slate-500"
          >
            Belum ada riwayat absensi untuk kelas dan tanggal ini.
          </p>
        ) : (
          <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-[13px] text-black min-[380px]:text-[14px]">
            <caption className="sr-only">
              Riwayat absensi{" "}
              {filters.id_kelas
                ? classes.items.find((item) => item.id === filters.id_kelas)
                    ?.name || `kelas ${filters.id_kelas}`
                : "semua kelas"}
              , {dateLabel}
            </caption>
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[38%]" />
              <col className="w-[25%]" />
              <col className="w-[28%]" />
            </colgroup>
            <thead className="text-[11px] text-[#003D32] min-[380px]:text-[12px]">
              <tr>
                <th scope="col" aria-label="Nomor">No.</th>
                <th scope="col">Nama siswa</th>
                <th scope="col">Kelas</th>
                <th scope="col" className="pr-1 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.items.map((record, index) => {
                const row = getHistoryRow(record);
                return (
                  <tr key={`${row.id || visible.currentPage}-${index}`}>
                    <td className="align-top pl-1 py-1">
                      {visible.offset + index + 1}.
                    </td>
                    <td className="break-words py-1 pr-2 align-top">
                      {row.name}
                    </td>
                    <td className="break-words py-1 pr-2 align-top text-[12px] min-[380px]:text-[13px]">
                      {row.className}
                    </td>
                    <td className="break-words py-1 pr-1 text-right align-top">
                      {row.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!visible.loading && !visible.error && visible.lastPage > 1 && (
          <nav
            aria-label="Halaman riwayat absensi"
            className="mt-5 flex items-center justify-between gap-2 text-[11px]"
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
    </section>
  );
}

function RequestError({ error, onRetry }) {
  return (
    <div
      role="alert"
      className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <p className="flex-1 leading-relaxed">{error.message}</p>
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

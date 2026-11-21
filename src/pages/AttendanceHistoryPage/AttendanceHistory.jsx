import { useEffect, useState } from "react";
import { ChevronDown, LoaderCircle, RefreshCw, Search, UserRound } from "lucide-react";
import {
  attendanceHistoryApi,
  getHistoryError,
  getHistoryRow,
  getHistoryTimes,
  getJakartaDate,
  historyDayCount,
  isValidHistoryDate,
  shiftHistoryDate,
  startOfHistoryWeek,
} from "../../services/attendanceHistory.js";

const longDate = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric",
});
const shortDate = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short",
});
const shortDateYear = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric",
});
const toDate = (value) => new Date(`${value}T12:00:00+07:00`);
const initialHistory = {
  items: [], recap: null, loading: true, error: null, currentPage: 1, lastPage: 1, offset: 0, total: null, key: "",
};
const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-[12px] font-semibold text-[#003D32] outline-none [color-scheme:light] focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:opacity-60";

function presets(today) {
  return [
    { key: "today", label: "Hari ini", dari: today, sampai: today },
    { key: "week", label: "Minggu ini", dari: startOfHistoryWeek(today), sampai: today },
    { key: "7days", label: "7 hari", dari: shiftHistoryDate(today, -6), sampai: today },
    { key: "month", label: "Bulan ini", dari: `${today.slice(0, 8)}01`, sampai: today },
  ];
}

export default function AttendanceHistory() {
  const today = getJakartaDate();
  const [filters, setFilters] = useState(() => ({ id_kelas: "", search: "", dari: today, sampai: today, page: 1 }));
  const [searchInput, setSearchInput] = useState("");
  const [classes, setClasses] = useState({ items: [], loading: true, error: null });
  const [history, setHistory] = useState(initialHistory);
  const [classesRevision, setClassesRevision] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const queryKey = JSON.stringify(filters);

  // Ketik nama/NIS: kirim setelah berhenti mengetik sebentar.
  useEffect(() => {
    const value = searchInput.trim();
    if (value === filters.search) return undefined;
    const timer = window.setTimeout(() => setFilters((previous) => ({ ...previous, search: value, page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.search]);

  useEffect(() => {
    const controller = new AbortController();
    setClasses((previous) => ({ ...previous, loading: true, error: null }));
    attendanceHistoryApi
      .getClasses({ signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) setClasses({ items, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setClasses({ items: [], loading: false, error: getHistoryError(error, "Daftar kelas") });
      });
    return () => controller.abort();
  }, [classesRevision]);

  useEffect(() => {
    const controller = new AbortController();
    setHistory({ ...initialHistory, key: queryKey });
    attendanceHistoryApi
      .getHistory(JSON.parse(queryKey), { signal: controller.signal })
      .then((collection) => {
        if (controller.signal.aborted) return;
        const total = Number(collection.payload?.meta?.total);
        setHistory({ ...collection, total: Number.isSafeInteger(total) ? total : null, key: queryKey, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setHistory({ ...initialHistory, key: queryKey, loading: false, error: getHistoryError(error) });
      });
    return () => controller.abort();
  }, [queryKey, historyRevision]);

  const visible = history.key === queryKey ? history : initialHistory;
  const fieldError = (name) => visible.error?.fields?.[name];
  const singleDay = filters.dari === filters.sampai;
  const rangeValid = isValidHistoryDate(filters.dari) && isValidHistoryDate(filters.sampai) && filters.sampai >= filters.dari;
  const dateLabel = !rangeValid
    ? "Rentang tanggal belum valid"
    : singleDay
      ? longDate.format(toDate(filters.dari))
      : `${shortDateYear.format(toDate(filters.dari))} – ${shortDateYear.format(toDate(filters.sampai))}`;
  const activePreset = presets(today).find((item) => item.dari === filters.dari && item.sampai === filters.sampai)?.key;
  const recap = visible.recap;
  // Rekap paling berguna untuk rentang beberapa hari atau saat mencari murid tertentu.
  const showRecap = Boolean(recap) && (!singleDay || filters.search !== "");

  function changeFilter(field, value) {
    setFilters((previous) => ({ ...previous, [field]: value, page: 1 }));
  }

  function changeDate(field, value) {
    // Input tanggal yang dikosongkan diabaikan agar filter tetap valid.
    if (isValidHistoryDate(value)) changeFilter(field, value);
  }

  return (
    <section aria-labelledby="attendance-history-title" className="text-[#003D32]">
      <header className="rounded-[24px] bg-white px-2 pb-3 pt-4 text-center shadow-[0_3px_5px_rgba(0,0,0,0.3),inset_0_4px_2px_rgba(0,0,0,0.4)] min-[380px]:px-4">
        <p className="text-[10px]">
          <time dateTime={`${filters.dari}/${filters.sampai}`}>{dateLabel}</time>
        </p>
        <h1
          id="attendance-history-title"
          className="text-[25px] font-bold leading-tight tracking-tight min-[380px]:text-[30px] [text-shadow:2px_3px_4px_rgba(0,0,0,0.4)]"
        >
          Riwayat Absensi
        </h1>
        <p className="mt-1 text-[10px] leading-snug min-[380px]:text-[11px]">
          Cari murid, pilih kelas dan rentang tanggal untuk melihat berapa kali hadir
        </p>
      </header>

      <div role="search" aria-label="Filter riwayat absensi" className="space-y-2 px-4 pb-3 pt-4">
        <div>
          <label htmlFor="history-search" className="mb-1 block text-[12px] font-bold">Cari murid</label>
          <div className="relative">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5" />
            <input
              id="history-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nama atau NIS murid..."
              autoComplete="off"
              maxLength={100}
              aria-invalid={Boolean(fieldError("search"))}
              className={`${inputClass} pl-8 font-normal`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="history-class" className="mb-1 block text-[12px] font-bold">Kelas</label>
          <div className="relative">
            <select
              id="history-class"
              value={filters.id_kelas}
              disabled={classes.loading || classes.items.length === 0}
              onChange={(event) => changeFilter("id_kelas", event.target.value)}
              aria-invalid={Boolean(fieldError("id_kelas"))}
              className={`${inputClass} appearance-none pr-6`}
            >
              <option value="">{classes.loading ? "Memuat kelas..." : "Semua kelas"}</option>
              {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2 top-2.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="history-from" className="mb-1 block text-[12px] font-bold">Dari tanggal</label>
            <input
              id="history-from"
              type="date"
              required
              value={filters.dari}
              max={today}
              onChange={(event) => changeDate("dari", event.target.value)}
              aria-invalid={Boolean(fieldError("dari"))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="history-to" className="mb-1 block text-[12px] font-bold">Sampai tanggal</label>
            <input
              id="history-to"
              type="date"
              required
              value={filters.sampai}
              max={today}
              onChange={(event) => changeDate("sampai", event.target.value)}
              aria-invalid={Boolean(fieldError("sampai"))}
              className={inputClass}
            />
          </div>
        </div>
        <div role="group" aria-label="Pilih rentang cepat" className="flex flex-wrap gap-1.5">
          {presets(today).map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={activePreset === item.key}
              onClick={() => setFilters((previous) => ({ ...previous, dari: item.dari, sampai: item.sampai, page: 1 }))}
              className="rounded-full border border-[#003D32] px-3 py-1 text-[11px] font-semibold transition aria-[pressed=true]:bg-[#003D32] aria-[pressed=true]:text-white hover:bg-emerald-50 aria-[pressed=true]:hover:bg-[#003D32]"
            >
              {item.label}
            </button>
          ))}
        </div>
        {(fieldError("dari") || fieldError("sampai") || fieldError("search")) && (
          <p role="alert" className="text-xs text-red-700">{fieldError("dari") || fieldError("sampai") || fieldError("search")}</p>
        )}
      </div>

      <div className="px-3">
        {classes.error && (
          <RequestError error={classes.error} onRetry={() => setClassesRevision((value) => value + 1)} />
        )}
        {visible.loading ? (
          <p role="status" className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
            <LoaderCircle size={15} className="animate-spin" />
            Memuat riwayat absensi...
          </p>
        ) : visible.error && !visible.error.fields?.dari && !visible.error.fields?.sampai && !visible.error.fields?.search ? (
          <RequestError error={visible.error} onRetry={() => setHistoryRevision((value) => value + 1)} />
        ) : visible.error ? null : (
          <>
            {showRecap && <RecapSection recap={recap} />}
            <h2 className="mb-1 mt-3 px-1 text-[13px] font-bold">
              Catatan absensi{visible.total != null ? ` (${visible.total.toLocaleString("id-ID")})` : ""}
            </h2>
            {visible.items.length === 0 ? (
              <p role="status" className="px-3 py-6 text-center text-xs text-slate-500">
                {filters.search
                  ? "Belum ada catatan absensi untuk murid ini pada rentang tanggal tersebut."
                  : "Belum ada riwayat absensi untuk kelas dan tanggal ini."}
              </p>
            ) : (
              <table className="w-full table-fixed border-separate border-spacing-y-1.5 text-left text-[12px] text-black min-[380px]:text-[13px]">
                <caption className="sr-only">Catatan absensi, {dateLabel}</caption>
                <colgroup>
                  <col className="w-[9%]" />
                  <col className="w-[41%]" />
                  <col className="w-[30%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead className="text-[11px] text-[#003D32]">
                  <tr>
                    <th scope="col" aria-label="Nomor">No.</th>
                    <th scope="col">Nama siswa</th>
                    <th scope="col">Tanggal</th>
                    <th scope="col" className="pr-1 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.items.map((record, index) => {
                    const row = getHistoryRow(record);
                    const times = getHistoryTimes(record);
                    return (
                      <tr key={`${row.id || visible.currentPage}-${index}`}>
                        <td className="py-1 pl-1 align-top">{visible.offset + index + 1}.</td>
                        <td className="break-words py-1 pr-2 align-top">
                          {row.name}
                          <span className="block text-[10px] text-slate-500">{row.className}</span>
                        </td>
                        <td className="py-1 pr-1 align-top text-[11px]">
                          {isValidHistoryDate(times.date) ? shortDate.format(toDate(times.date)) : "—"}
                          <span className="block text-[10px] tabular-nums text-slate-500">
                            {times.checkIn || "—"}{times.checkOut ? `–${times.checkOut}` : ""}
                          </span>
                        </td>
                        <td className="break-words py-1 pr-1 text-right align-top">{row.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {visible.lastPage > 1 && (
              <nav aria-label="Halaman riwayat absensi" className="mt-4 flex items-center justify-between gap-2 text-[11px]">
                <button
                  type="button"
                  disabled={visible.currentPage <= 1}
                  onClick={() => setFilters((previous) => ({ ...previous, page: visible.currentPage - 1 }))}
                  className="rounded-md border border-emerald-900/30 px-2 py-2 disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <span>Halaman {visible.currentPage} / {visible.lastPage}</span>
                <button
                  type="button"
                  disabled={visible.currentPage >= visible.lastPage}
                  onClick={() => setFilters((previous) => ({ ...previous, page: visible.currentPage + 1 }))}
                  className="rounded-md border border-emerald-900/30 px-2 py-2 disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function RecapSection({ recap }) {
  const base = recap.recordedDays || 0;
  const days = recap.days ?? (recap.dari && recap.sampai ? historyDayCount(recap.dari, recap.sampai) : null);
  return (
    <section aria-labelledby="history-recap-title" className="rounded-xl border border-[#003D32] bg-[#005343] p-3 text-white">
      <h2 id="history-recap-title" className="text-[13px] font-bold">Rekap kehadiran</h2>
      <p className="text-[10px] text-emerald-50/90">
        {days != null ? `${days} hari dipilih · ` : ""}{base} hari ada catatan absensi di sekolah
      </p>
      {recap.students.length === 0 ? (
        <p className="mt-2 text-xs">Tidak ada murid yang cocok dengan filter.</p>
      ) : (
        <ul aria-label="Jumlah hadir per murid" className="mt-2 space-y-1.5">
          {recap.students.map((student) => {
            const percent = base > 0 ? Math.min(100, Math.round((student.present / base) * 100)) : 0;
            return (
              <li key={student.id || student.name} className="rounded-lg bg-white px-2.5 py-2 text-[#003D32]">
                <div className="flex items-start gap-2">
                  <UserRound size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[12px] font-bold leading-tight">{student.name}</p>
                    <p className="text-[10px] text-slate-500">{student.className}</p>
                  </div>
                  <p className="shrink-0 text-right text-[12px] font-bold leading-tight">
                    {student.present}× hadir
                    {base > 0 && <span className="block text-[10px] font-normal text-slate-500">dari {base} hari</span>}
                  </p>
                </div>
                {base > 0 && (
                  <div
                    role="progressbar"
                    aria-label={`Kehadiran ${student.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-100"
                  >
                    <div className={`h-full rounded-full ${percent >= 75 ? "bg-emerald-600" : percent >= 50 ? "bg-amber-500" : "bg-red-600"}`} style={{ width: `${percent}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {recap.total > recap.students.length && (
        <p className="mt-2 text-[10px] text-emerald-50/90">
          Menampilkan {recap.students.length} dari {recap.total} murid. Persempit dengan kelas atau nama.
        </p>
      )}
    </section>
  );
}

function RequestError({ error, onRetry }) {
  return (
    <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="flex-1 leading-relaxed">{error.message}</p>
      <button type="button" onClick={onRetry} className="flex shrink-0 items-center gap-1 rounded p-1 hover:bg-amber-100">
        <RefreshCw size={13} />
        Coba lagi
      </button>
    </div>
  );
}

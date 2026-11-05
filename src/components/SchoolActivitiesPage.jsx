import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Search } from "lucide-react";
import { attendanceHistoryApi } from "../services/attendanceHistory.js";
import { getActivityError, SCHOOL_DAYS } from "../services/activityApi.js";
import ActivityDialog from "./SchoolActivityDialog.jsx";
import { ActivityError, ActivityFacts, ActivityLoading } from "./SchoolActivityContent.jsx";

const initialList = { items: [], loading: true, error: null, currentPage: 1, lastPage: 1, key: "" };
const filterClass = "h-9 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-[#003D32] outline-none focus:ring-2 focus:ring-emerald-300";

export default function SchoolActivitiesPage({ config }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ search: "", hari: "", ...(config.withClass ? { id_kelas: "" } : {}), page: 1 });
  const [list, setList] = useState(initialList);
  const [revision, setRevision] = useState(0);
  const [classRevision, setClassRevision] = useState(0);
  const [classes, setClasses] = useState({ items: [], loading: config.withClass, error: null });
  const [dialog, setDialog] = useState(null);
  const [success, setSuccess] = useState("");
  const queryKey = JSON.stringify(filters);

  useEffect(() => {
    if (search.trim() === filters.search) return;
    const timer = window.setTimeout(() => setFilters((value) => ({ ...value, search: search.trim(), page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [search, filters.search]);

  useEffect(() => {
    const controller = new AbortController();
    setList({ ...initialList, key: queryKey });
    config.api.list(JSON.parse(queryKey), { signal: controller.signal }).then((collection) => {
      if (!controller.signal.aborted) setList({ ...collection, loading: false, error: null, key: queryKey });
    }).catch((error) => {
      if (!controller.signal.aborted) setList({ ...initialList, loading: false, error: getActivityError(error), key: queryKey });
    });
    return () => controller.abort();
  }, [config, queryKey, revision]);

  useEffect(() => {
    if (!config.withClass) return;
    const controller = new AbortController();
    setClasses({ items: [], loading: true, error: null });
    attendanceHistoryApi.getClasses({ signal: controller.signal }).then((items) => {
      if (!controller.signal.aborted) setClasses({ items, loading: false, error: null });
    }).catch((error) => {
      if (!controller.signal.aborted) setClasses({ items: [], loading: false, error: getActivityError(error) });
    });
    return () => controller.abort();
  }, [config.withClass, classRevision]);

  const visible = list.key === queryKey && search.trim() === filters.search ? list : initialList;
  function filter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value, search: search.trim(), page: 1 }));
  }
  function open(mode, id) { setSuccess(""); setDialog({ mode, id }); }
  function saved(created) {
    setDialog(null);
    setSuccess(`${config.title} berhasil ${created ? "ditambahkan" : "diperbarui"}.`);
    if (created) {
      setSearch("");
      setFilters({ search: "", hari: "", ...(config.withClass ? { id_kelas: "" } : {}), page: 1 });
    }
    setRevision((value) => value + 1);
  }
  function submitSearch(event) {
    event.preventDefault();
    if (filters.search === search.trim() && filters.page === 1) setRevision((value) => value + 1);
    else filter("search", search.trim());
  }

  return (
    <section aria-labelledby={`${config.key}-title`} className="text-[#003D32]">
      <header className="rounded-[24px] bg-white px-3 pb-8 pt-4 text-center shadow-[0_3px_5px_rgba(0,0,0,0.3),inset_0_4px_2px_rgba(0,0,0,0.4)]">
        <h1 id={`${config.key}-title`} className="text-[26px] font-bold leading-tight [text-shadow:2px_3px_4px_rgba(0,0,0,0.4)] min-[380px]:text-[32px]">{config.title}</h1>
        <p className="mt-1 text-[10px] min-[380px]:text-[11px]">{config.subtitle}</p>
      </header>
      {config.Carousel && <div className="relative mx-3 -mt-3"><config.Carousel revision={revision} paused={Boolean(dialog)} /></div>}
      <div className={`relative mx-3 rounded-t-[28px] rounded-b-lg border border-[#003D32] bg-[#005343] px-3 py-4 min-[380px]:px-4 ${config.Carousel ? "mt-3" : "-mt-4"}`}>
        <form role="search" onSubmit={submitSearch} className="relative">
          <label htmlFor={`${config.key}-search`} className="sr-only">{config.searchLabel}</label>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5" />
          <input id={`${config.key}-search`} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.searchLabel} autoComplete="off" className={`${filterClass} pl-9`} />
        </form>
        <div className={`mt-2 grid gap-2 ${config.withClass ? "grid-cols-2" : "grid-cols-1"}`}>
          <div>
            <label htmlFor={`${config.key}-day`} className="mb-1 block text-[10px] font-semibold text-white">Hari</label>
            <select id={`${config.key}-day`} value={filters.hari} onChange={(event) => filter("hari", event.target.value)} className={filterClass}>
              <option value="">Semua hari</option>
              {SCHOOL_DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </div>
          {config.withClass && <div>
            <label htmlFor={`${config.key}-class`} className="mb-1 block text-[10px] font-semibold text-white">Kelas</label>
            <select id={`${config.key}-class`} value={filters.id_kelas} disabled={classes.loading || Boolean(classes.error)} onChange={(event) => filter("id_kelas", event.target.value)} className={filterClass}>
              <option value="">{classes.loading ? "Memuat kelas..." : "Semua kelas"}</option>
              {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>}
        </div>
        {classes.error && <div className="mt-2"><ActivityError message={`Pilihan kelas: ${classes.error.message}`} onRetry={() => setClassRevision((value) => value + 1)} /></div>}
        <button type="button" aria-label={`Tambah ${config.title}`} onClick={() => open("create")} className="mt-3 flex min-h-9 w-full items-center justify-center gap-1 rounded-lg bg-white px-2 py-2 text-xs font-semibold hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-300"><Plus size={14} aria-hidden="true" />Tambah {config.title}</button>
      </div>
      <div className="mx-3 mt-3">
        {success && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">{success}</p>}
        <div aria-busy={visible.loading}>
          {visible.loading ? <ActivityLoading /> : visible.error ? <ActivityError message={Object.values(visible.error.fields)[0] || visible.error.message} onRetry={() => setRevision((value) => value + 1)} /> : !visible.items.length ? (
            <p role="status" className="py-8 text-center text-xs text-slate-500">{filters.search || filters.hari || filters.id_kelas ? "Tidak ada data yang cocok dengan filter." : `Belum ada data ${config.title.toLowerCase()}.`}</p>
          ) : <ul aria-label={`Daftar ${config.title}`} className={`${config.Card ? "space-y-4" : "space-y-2"} md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3`}>
            {visible.items.map((record) => {
              const item = config.view(record);
              if (config.Card) return <config.Card key={item.id} item={item} onDetail={() => open("detail", item.id)} onEdit={() => open("edit", item.id)} />;
              return <li key={item.id} className="rounded-xl border border-[#003D32] bg-[#005343] p-3 text-white min-[380px]:p-4">
                <div className="flex items-start gap-2">
                  <config.Icon size={25} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <h2 className="min-w-0 flex-1 break-words text-sm font-bold">{item.title}</h2>
                  {item.status && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] ${item.status === "ACTIVE" ? "bg-emerald-100 text-emerald-950" : "bg-slate-200 text-slate-800"}`}>{item.status === "ACTIVE" ? "Aktif" : item.status === "INACTIVE" ? "Nonaktif" : item.status}</span>}
                </div>
                <ActivityFacts item={item} withClass={config.withClass} />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" aria-label={`Detail ${item.title}`} onClick={() => open("detail", item.id)} className="flex min-h-8 items-center justify-center gap-1 rounded-md bg-white text-xs font-semibold text-[#003D32] hover:bg-emerald-50"><Eye size={14} aria-hidden="true" />Detail</button>
                  <button type="button" aria-label={`Edit ${item.title}`} onClick={() => open("edit", item.id)} className="flex min-h-8 items-center justify-center gap-1 rounded-md bg-white text-xs font-semibold text-[#003D32] hover:bg-emerald-50"><Pencil size={13} aria-hidden="true" />Edit</button>
                </div>
              </li>;
            })}
          </ul>}
        </div>
        {!visible.loading && !visible.error && visible.lastPage > 1 && <nav aria-label={`Halaman ${config.title}`} className="mt-4 flex items-center justify-between gap-2 text-[11px]">
          <button type="button" disabled={visible.currentPage <= 1} onClick={() => setFilters((value) => ({ ...value, page: visible.currentPage - 1 }))} className="rounded-md border border-emerald-900/30 p-2 disabled:opacity-40">Sebelumnya</button>
          <span>Halaman {visible.currentPage} / {visible.lastPage}</span>
          <button type="button" disabled={visible.currentPage >= visible.lastPage} onClick={() => setFilters((value) => ({ ...value, page: visible.currentPage + 1 }))} className="rounded-md border border-emerald-900/30 p-2 disabled:opacity-40">Berikutnya</button>
        </nav>}
      </div>
      {dialog && <ActivityDialog config={config} initialMode={dialog.mode} id={dialog.id} onClose={() => setDialog(null)} onSaved={saved} />}
    </section>
  );
}


import { CalendarDays, Clock3, LoaderCircle, MapPin, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { dayLabel } from "../services/activityApi.js";

export function ActivityFacts({ item, withClass }) {
  return <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed">
    {withClass && <p className="flex items-start gap-2"><UsersRound size={14} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="break-words">Kelas: {item.className || "—"}</span></p>}
    <p className="flex items-start gap-2"><UserRound size={14} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="break-words">{withClass ? "Guru" : "Pembina"}: {item.teacherName || "—"}</span></p>
    <p className="flex items-center gap-2"><CalendarDays size={14} aria-hidden="true" className="shrink-0" />{dayLabel(item.hari)}</p>
    <p className="flex items-center gap-2"><Clock3 size={14} aria-hidden="true" className="shrink-0" />{item.start || "—"} – {item.end || "—"} WIB</p>
    <p className="flex items-start gap-2"><MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="break-words">{item.location || "Lokasi belum ditentukan"}</span></p>
    {!withClass && <p className="flex items-center gap-2"><UsersRound size={14} aria-hidden="true" />{item.members == null ? "—" : item.members.toLocaleString("id-ID")} anggota</p>}
  </div>;
}

export function ActivityLoading() {
  return <p role="status" className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Memuat data...</p>;
}

export function ActivityError({ message, onRetry }) {
  return <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p>{message}</p><button type="button" onClick={onRetry} className="mt-2 flex items-center gap-1 rounded p-1 font-semibold hover:bg-amber-100"><RefreshCw size={13} aria-hidden="true" />Coba lagi</button></div>;
}

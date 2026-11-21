import { useState } from "react";
import { CalendarDays, Clock3, History, LogIn, LogOut, Trophy, UserX } from "lucide-react";
import { getDashboardInsights } from "./dashboardData.js";

/**
 * Panel informasi tambahan Dashboard dari /api/dashboard/ringkasan:
 * kehadiran hari ini, tren 7 hari & absensi terbaru (guru), kehadiran saya (siswa),
 * jadwal hari ini, dan ekstrakurikuler hari ini.
 */
export default function DashboardInsights({ summary, isTeacher }) {
  const insights = getDashboardInsights(summary?.data);
  if (!insights) return null;

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      {isTeacher ? <TodayAttendance data={insights.attendance} /> : <MyAttendance data={insights.mine} />}
      {isTeacher && <AttendanceTrend trend={insights.trend} />}
      <ListPanel
        title={isTeacher ? "Jadwal mengajar hari ini" : "Jadwal kelas hari ini"}
        Icon={CalendarDays}
        empty={isTeacher ? "Tidak ada jadwal mengajar hari ini." : "Tidak ada jadwal pelajaran hari ini."}
        items={insights.schedule.map((item) => ({
          key: `${item.start}-${item.title}-${item.className}`,
          title: item.title,
          detail: [isTeacher ? item.className : item.teacher, item.room].filter(Boolean).join(" · "),
          side: `${item.start}–${item.end}`,
        }))}
      />
      <ListPanel
        title="Ekstrakurikuler hari ini"
        Icon={Trophy}
        empty="Tidak ada kegiatan ekstrakurikuler hari ini."
        items={insights.extracurriculars.map((item) => ({
          key: `${item.start}-${item.title}`,
          title: item.title,
          detail: item.location,
          side: `${item.start}–${item.end}`,
        }))}
      />
      {isTeacher && (
        <ListPanel
          title="Absensi terbaru hari ini"
          Icon={History}
          empty="Belum ada siswa yang absen hari ini."
          items={insights.latest.map((item, index) => ({
            key: `${item.name}-${index}`,
            title: item.name,
            detail: item.className,
            side: item.checkOut ? `Pulang ${item.checkOut}` : `Masuk ${item.checkIn || "—"}`,
          }))}
        />
      )}
    </div>
  );
}

function Panel({ title, Icon, children }) {
  return (
    <section aria-label={title} className="rounded-xl border border-slate-200 bg-white p-3 text-[#003D32] shadow-sm">
      <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold">
        <Icon size={14} aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function TodayAttendance({ data }) {
  const percent = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
  return (
    <Panel title="Kehadiran hari ini" Icon={LogIn}>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[26px] font-bold leading-none tabular-nums">{percent}%</p>
        <p className="text-right text-[10px] text-slate-600">
          {data.present.toLocaleString("id-ID")} dari {data.total.toLocaleString("id-ID")} siswa sudah absen masuk
        </p>
      </div>
      <div role="progressbar" aria-label="Persentase siswa hadir hari ini" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full rounded-full bg-[#005343]" style={{ width: `${percent}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Figure label="Hadir" value={data.present} Icon={LogIn} />
        <Figure label="Sudah pulang" value={data.left} Icon={LogOut} />
        <Figure label="Belum hadir" value={data.absent} Icon={UserX} />
      </dl>
    </Panel>
  );
}

function Figure({ label, value, Icon }) {
  return (
    <div className="rounded-lg bg-emerald-50 px-1 py-1.5">
      <dt className="flex items-center justify-center gap-1 text-[9px] text-slate-600">
        <Icon size={10} aria-hidden="true" />{label}
      </dt>
      <dd className="text-[15px] font-bold tabular-nums">{value.toLocaleString("id-ID")}</dd>
    </div>
  );
}

function MyAttendance({ data }) {
  const status = !data.today
    ? { text: "Belum absen hari ini", tone: "bg-amber-50 text-amber-900" }
    : data.today.checkOut
      ? { text: `Masuk ${data.today.checkIn} · Pulang ${data.today.checkOut}`, tone: "bg-emerald-50 text-emerald-900" }
      : { text: `Sudah absen masuk pukul ${data.today.checkIn}`, tone: "bg-emerald-50 text-emerald-900" };
  return (
    <Panel title="Kehadiran saya" Icon={Clock3}>
      <p role="status" className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold ${status.tone}`}>{status.text}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-emerald-50 py-1.5">
          <dt className="text-[9px] text-slate-600">Hadir minggu ini</dt>
          <dd className="text-[15px] font-bold tabular-nums">{data.week} hari</dd>
        </div>
        <div className="rounded-lg bg-emerald-50 py-1.5">
          <dt className="text-[9px] text-slate-600">Hadir bulan ini</dt>
          <dd className="text-[15px] font-bold tabular-nums">{data.month} hari</dd>
        </div>
      </dl>
    </Panel>
  );
}

const dayShort = { senin: "Sen", selasa: "Sel", rabu: "Rab", kamis: "Kam", jumat: "Jum", sabtu: "Sab", minggu: "Min" };
const dateLong = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long" });

/** Satu seri: jumlah siswa hadir per hari. Batang tipis, ujung atas membulat, tooltip saat hover/fokus. */
function AttendanceTrend({ trend }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...trend.map((day) => day.present));
  const last = trend.length - 1;
  const focused = active ?? last;
  return (
    <Panel title="Tren kehadiran 7 hari" Icon={CalendarDays}>
      <p className="mb-2 text-[10px] text-slate-600" aria-live="polite">
        {trend[focused] ? `${dateLong.format(new Date(`${trend[focused].date}T12:00:00+07:00`))}: ${trend[focused].present.toLocaleString("id-ID")} siswa hadir` : ""}
      </p>
      <div className="relative flex h-24 items-end gap-2 border-b border-slate-200" aria-hidden="true">
        {/* Garis bantu tengah, samar. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" />
        {trend.map((day, index) => (
          <button
            key={day.date}
            type="button"
            tabIndex={-1}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onClick={() => setActive(index)}
            title={`${day.present} siswa hadir`}
            className="group relative flex h-full flex-1 items-end justify-center"
          >
            {index === last && day.present > 0 && (
              <span className="absolute text-[9px] font-bold leading-none text-[#003D32]" style={{ bottom: `calc(${(day.present / max) * 100}% + 2px)` }}>{day.present}</span>
            )}
            <span
              className={`block w-full max-w-[18px] rounded-t-[4px] ${focused === index ? "bg-[#003D32]" : "bg-[#5aa897]"}`}
              style={{ height: day.present ? `${Math.max(4, (day.present / max) * 100)}%` : "2px" }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-center text-[9px] text-slate-500" aria-hidden="true">
        {trend.map((day, index) => (
          <span key={day.date} className={`flex-1 ${index === last ? "font-bold text-[#003D32]" : ""}`}>
            {index === last ? "Hari ini" : dayShort[day.day] ?? ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Jumlah siswa hadir 7 hari terakhir</caption>
        <thead><tr><th scope="col">Tanggal</th><th scope="col">Hadir</th></tr></thead>
        <tbody>
          {trend.map((day) => <tr key={day.date}><td>{day.date}</td><td>{day.present}</td></tr>)}
        </tbody>
      </table>
    </Panel>
  );
}

function ListPanel({ title, Icon, items, empty }) {
  return (
    <Panel title={title} Icon={Icon}>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <p className="break-words text-[12px] font-semibold leading-tight">{item.title}</p>
                {item.detail && <p className="break-words text-[10px] text-slate-500">{item.detail}</p>}
              </div>
              <p className="shrink-0 text-[10px] font-semibold tabular-nums">{item.side}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

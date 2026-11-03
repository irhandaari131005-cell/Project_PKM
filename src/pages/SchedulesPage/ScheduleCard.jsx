import { ArrowUpRight, Pencil } from "lucide-react";
import { dayLabel } from "../../services/activityApi.js";

export default function ScheduleCard({ item, onDetail, onEdit }) {
  return (
    <li className="group relative isolate">
      {/* Aksen belakang berputar saat hover atau saat tombol mendapat fokus keyboard. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[24px] bg-[#0046bb] opacity-0 transition-[transform,opacity] duration-300 ease-out group-hover:rotate-3 group-hover:opacity-100 group-focus-within:rotate-3 group-focus-within:opacity-100 motion-reduce:transition-none"
      />
      <article
        aria-label={`Jadwal ${item.title}`}
        className="relative flex min-h-[240px] flex-col rounded-[24px] border border-slate-100 bg-white p-4 text-[#222222] shadow-[0_2px_5px_rgba(0,0,0,0.06)] transition-[box-shadow,transform] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_7px_15px_rgba(0,0,0,0.12)] group-focus-within:-translate-y-0.5 group-focus-within:shadow-[0_7px_15px_rgba(0,0,0,0.12)] motion-reduce:transform-none motion-reduce:transition-none min-[380px]:p-5"
      >
        <h2 className="break-words text-[13px] font-semibold uppercase leading-snug text-[#003da6] min-[380px]:text-[14px]">
          {item.title}
        </h2>
        <p className="mt-0.5 break-words text-[9px] leading-relaxed text-[#777777]">
          Jadwal pelajaran · {item.className || "—"} · {dayLabel(item.hari)}
        </p>

        <dl className="mt-3 space-y-2.5">
          <div>
            <dt className="text-[10px] text-[#777777]">Guru</dt>
            <dd className="mt-0.5 break-words text-[12px] leading-snug">
              {item.teacherName || "—"}
            </dd>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <dt className="text-[10px] text-[#777777]">Kelas</dt>
              <dd className="mt-0.5 break-words text-[12px] leading-snug">
                {item.className || "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] text-[#777777]">Jam mulai</dt>
              <dd className="mt-0.5 text-[12px] leading-snug">
                {item.start || "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] text-[#777777]">Jam selesai</dt>
              <dd className="mt-0.5 text-[12px] leading-snug">
                {item.end || "—"}
              </dd>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <dt className="text-[10px] text-[#777777]">Hari</dt>
              <dd className="mt-0.5 text-[12px] leading-snug">{dayLabel(item.hari)}</dd>
            </div>
            {item.location && (
              <div className="min-w-0">
                <dt className="text-[10px] text-[#777777]">Ruangan</dt>
                <dd className="mt-0.5 break-words text-[12px] leading-snug">{item.location}</dd>
              </div>
            )}
          </div>
        </dl>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <button
            type="button"
            aria-label={`Edit ${item.title}`}
            onClick={onEdit}
            className="flex min-h-8 items-center gap-1 rounded-md px-1 text-[10px] text-slate-500 transition-colors hover:text-[#0046bb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <Pencil size={12} aria-hidden="true" />
            Edit jadwal
          </button>
          <button
            type="button"
            aria-label={`Detail ${item.title}`}
            onClick={onDetail}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#222222] bg-slate-100 text-[#222222] transition-colors duration-300 group-hover:border-[#0046bb] group-hover:bg-blue-100 group-hover:text-[#0046bb] group-focus-within:border-[#0046bb] group-focus-within:bg-blue-100 group-focus-within:text-[#0046bb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <ArrowUpRight size={19} aria-hidden="true" className="transition-transform duration-300 group-hover:rotate-45 group-focus-within:rotate-45 motion-reduce:transition-none" />
          </button>
        </div>
      </article>
    </li>
  );
}

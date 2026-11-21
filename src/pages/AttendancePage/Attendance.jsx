import { useEffect, useRef, useState } from "react";
import { Check, Clock3, LoaderCircle, X } from "lucide-react";
import {
  attendanceApi,
  ATTENDANCE_TYPES,
  getAttendanceError,
} from "../../services/attendance.js";
import { createCardReader, CARD_READER_DEFAULTS } from "../../services/cardReader.js";

const clockFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const MAX_LOG = 6;

function isTypingTarget(target) {
  if (!target || typeof target !== "object") return false;
  const tag = typeof target.tagName === "string" ? target.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable === true;
}

export default function Attendance() {
  const [now, setNow] = useState(() => new Date());
  const [kind, setKind] = useState("masuk");
  const [processing, setProcessing] = useState(false);
  const [log, setLog] = useState([]);
  // Jumlah tap berhasil/gagal sejak halaman dibuka (petugas tahu sudah berapa siswa terproses).
  const [tally, setTally] = useState({ ok: 0, failed: 0 });
  const kindRef = useRef(kind);
  const queue = useRef([]);
  const busy = useRef(false);
  const mounted = useRef(true);
  const controllers = useRef(new Set());
  const sequence = useRef(0);

  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      queue.current = [];
      for (const controller of controllers.current) controller.abort();
    };
  }, []);

  // Tap diproses satu per satu sesuai urutan; tap berikutnya (siswa B, C, ...) langsung
  // masuk antrean tanpa perlu menekan tombol apa pun.
  async function processQueue() {
    if (busy.current) return;
    busy.current = true;
    setProcessing(true);
    while (queue.current.length && mounted.current) {
      const item = queue.current.shift();
      const controller = new AbortController();
      controllers.current.add(controller);
      let entry;
      try {
        const response = await attendanceApi.submit(
          { sn: item.sn, jenis_absensi: item.kind },
          { signal: controller.signal },
        );
        const record = response.record ?? {};
        entry = {
          ok: true,
          message: response.message,
          name: record.nama_siswa ?? record.nama ?? record.user?.nama,
          action: response.payload?.action === "check_out" || item.kind === "pulang" ? "Absen pulang" : "Absen masuk",
        };
      } catch (requestError) {
        if (controller.signal.aborted) break;
        entry = { ok: false, message: getAttendanceError(requestError).message };
      } finally {
        controllers.current.delete(controller);
      }
      if (!mounted.current) break;
      const row = { ...entry, id: item.id, at: new Date() };
      setLog((current) => [row, ...current].slice(0, MAX_LOG));
      setTally((current) => (entry.ok ? { ...current, ok: current.ok + 1 } : { ...current, failed: current.failed + 1 }));
    }
    busy.current = false;
    if (mounted.current) setProcessing(false);
  }

  useEffect(() => {
    let idleTimer = null;
    const reader = createCardReader((sn) => {
      sequence.current += 1;
      queue.current.push({ id: sequence.current, sn, kind: kindRef.current });
      processQueue();
    });

    function onKeyDown(event) {
      // Jangan ganggu kolom input lain (mis. modal ganti password di dashboard).
      if (event.defaultPrevented || event.isComposing || isTypingTarget(event.target)) return;
      if (reader.handleKey(event, Date.now())) {
        event.preventDefault();
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(
          () => reader.flushIfIdle(Date.now()),
          CARD_READER_DEFAULTS.idleSubmitMs + 20,
        );
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(idleTimer);
    };
    // processQueue hanya memakai ref, jadi listener cukup dipasang sekali.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latest = log[0];
  const status = processing
    ? "Memproses kartu..."
    : latest
      ? latest.ok
        ? "Absensi berhasil!"
        : "Absensi belum berhasil"
      : "Tempelkan kartu Anda";
  const kindLabel = ATTENDANCE_TYPES.find(({ value }) => value === kind)?.label ?? "";

  const failed = Boolean(latest && !latest.ok && !processing);

  // Ringkas: header satu baris, tombol mode, panel status horizontal, lalu daftar hasil tap.
  return (
    <section aria-labelledby="attendance-title" className="pb-2 text-[#003D32]">
      <div className="flex items-center justify-between gap-2 rounded-[20px] px-4 py-3 shadow-[0_3px_5px_rgba(0,0,0,0.3),inset_0_4px_2px_rgba(0,0,0,0.4)]">
        <div className="min-w-0">
          <h1 id="attendance-title" className="text-[22px] font-bold leading-tight tracking-tight [text-shadow:1px_2px_3px_rgba(0,0,0,0.35)]">
            Absensi
          </h1>
          <p className="truncate text-[10px]">{dateFormat.format(now)}</p>
        </div>
        <p className="flex shrink-0 items-center gap-1 rounded-full bg-[#003D32] px-2.5 py-1 text-[13px] font-semibold tabular-nums text-white">
          <Clock3 size={13} aria-hidden="true" />
          <time dateTime={now.toISOString()}>{clockFormat.format(now)}</time>
        </p>
      </div>

      <div className="mx-4 mt-3 md:mx-auto md:max-w-md">
        <div role="group" aria-label="Jenis absensi" className="grid grid-cols-2 gap-2">
          {ATTENDANCE_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={`min-h-10 rounded-lg border-2 border-[#003D32] px-2 py-2 text-[13px] font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${kind === value ? "bg-[#003D32] text-white" : "bg-white text-[#003D32] hover:bg-emerald-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          aria-busy={processing}
          className={`mt-3 flex items-center gap-3 rounded-xl border-2 p-3 ${failed ? "border-red-700 bg-red-50" : "border-[#003D32] bg-[#003D32] text-white"}`}
        >
          <div aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${failed ? "bg-red-700 text-white" : "bg-white/10"}`}>
            {processing ? (
              <LoaderCircle size={30} className="animate-spin" />
            ) : !latest ? (
              <div className="h-10 w-10"><ScannerIllustration /></div>
            ) : latest.ok ? (
              <Check size={32} strokeWidth={1.75} />
            ) : (
              <X size={30} strokeWidth={1.75} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p aria-live="polite" className={`text-[17px] font-semibold leading-tight ${failed ? "text-red-800" : ""}`}>{status}</p>
            <p className={`mt-0.5 text-[11px] ${failed ? "text-red-800" : "text-emerald-50/90"}`}>
              Mode <strong>{kindLabel}</strong> · siswa berikutnya bisa langsung tap
            </p>
          </div>
        </div>

        <dl className="mt-2 grid grid-cols-2 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-emerald-50 py-1">
            <dt className="text-slate-600">Berhasil sesi ini</dt>
            <dd className="text-[15px] font-bold tabular-nums">{tally.ok}</dd>
          </div>
          <div className="rounded-lg bg-red-50 py-1">
            <dt className="text-slate-600">Gagal sesi ini</dt>
            <dd className="text-[15px] font-bold tabular-nums text-red-800">{tally.failed}</dd>
          </div>
        </dl>

        {log.length > 0 && (
          <ol aria-label="Hasil tap terakhir" className="mt-3 space-y-1.5 text-left">
            {log.map((entry, index) => (
              <li
                key={entry.id}
                role={index === 0 ? (entry.ok ? "status" : "alert") : undefined}
                className={`rounded-lg px-3 py-2 text-xs leading-snug ${entry.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"} ${index === 0 ? "" : "opacity-70"}`}
              >
                <p className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {entry.ok ? (typeof entry.name === "string" ? entry.name : entry.action) : "Gagal"}
                  </span>
                  <time dateTime={entry.at.toISOString()} className="shrink-0 tabular-nums">
                    {timeFormat.format(entry.at)}
                  </time>
                </p>
                <p className="mt-0.5">{entry.ok ? `${entry.action} — ${entry.message}` : entry.message}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function ScannerIllustration() {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      className="h-full w-full text-white"
      aria-hidden="true"
    >
      <path
        d="M35 80V42a7 7 0 0 1 7-7h38M160 35h38a7 7 0 0 1 7 7v38M205 160v38a7 7 0 0 1-7 7h-38M80 205H42a7 7 0 0 1-7-7v-38"
        stroke="currentColor"
        strokeWidth="15"
      />
      <path
        d="M65 95V65h110v30M65 145v30h110v-30"
        stroke="currentColor"
        strokeWidth="13"
      />
      <path d="M22 120h196" stroke="currentColor" strokeWidth="17" />
    </svg>
  );
}

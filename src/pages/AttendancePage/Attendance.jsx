import { useEffect, useRef, useState } from "react";
import { Check, Clock3, LoaderCircle, ScanLine, X } from "lucide-react";
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

  return (
    <section aria-labelledby="attendance-title" className="pb-2 text-[#003D32]">
      <div className="rounded-[24px] px-4 pb-5 pt-3 text-center shadow-[0_3px_5px_rgba(0,0,0,0.3),inset_0_4px_2px_rgba(0,0,0,0.4)] min-[380px]:pb-7 min-[380px]:pt-5">
        <p className="flex items-center justify-center gap-1 text-[11px] font-medium ">
          <Clock3 size={12} aria-hidden="true" />
          <time dateTime={now.toISOString()}>{clockFormat.format(now)}</time>
        </p>
        <h1
          id="attendance-title"
          className="text-[26px] font-bold leading-tight tracking-tight min-[380px]:text-[32px] [text-shadow:2px_3px_4px_rgba(0,0,0,0.4)]"
        >
          Absensi
        </h1>
        <p className="mt-1 text-[11px]">{dateFormat.format(now)}</p>
      </div>

      <div
        role="group"
        aria-label="Jenis absensi"
        className="relative mx-8 -mt-3 grid grid-cols-2 gap-2 md:mx-auto md:max-w-md"
      >
        {ATTENDANCE_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={`min-h-12 rounded-xl border-2 border-[#003D32] px-2 py-3 text-[13px] font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${kind === value ? "bg-[#003D32] text-white" : "bg-white text-[#003D32] hover:bg-emerald-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div aria-busy={processing} className="mx-8 mt-6 text-center min-[380px]:mt-8 md:mx-auto md:max-w-md">
        <div
          aria-hidden="true"
          className="flex aspect-square w-full items-center justify-center rounded-[12px] rounded-tr-[38px] border-[3px] border-[#002d24] bg-[#003D32] p-7"
        >
          <ScannerIllustration />
        </div>

        <p
          aria-live="polite"
          className="mt-4 text-[20px] font-medium leading-tight min-[380px]:mt-5 min-[380px]:text-[22px]"
        >
          {status}
        </p>
        <div
          aria-hidden="true"
          className={`mx-auto mt-3 flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 bg-white p-[3px] min-[380px]:mt-4 min-[380px]:h-[66px] min-[380px]:w-[66px] ${latest && !latest.ok && !processing ? "border-red-700" : "border-[#003D32]"}`}
        >
          <span
            className={`flex h-full w-full items-center justify-center rounded-full text-white ${latest && !latest.ok && !processing ? "bg-red-700" : "bg-[#003D32]"}`}
          >
            {processing ? (
              <LoaderCircle size={34} className="animate-spin" />
            ) : !latest ? (
              <ScanLine size={32} strokeWidth={1.5} />
            ) : latest.ok ? (
              <Check size={36} strokeWidth={1.5} />
            ) : (
              <X size={34} strokeWidth={1.5} />
            )}
          </span>
        </div>
        <p className="mt-3 text-[12px] min-[380px]:mt-4">
          Mode <strong>{kindLabel}</strong> aktif. Pastikan TAP kartu dengan tepat!
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          Siswa berikutnya bisa langsung tap tanpa menekan tombol apa pun.
        </p>

        {log.length > 0 && (
          <ol aria-label="Hasil tap terakhir" className="mt-4 space-y-2 text-left">
            {log.map((entry, index) => (
              <li
                key={entry.id}
                role={index === 0 ? (entry.ok ? "status" : "alert") : undefined}
                className={`rounded-lg p-3 text-xs leading-relaxed ${entry.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"} ${index === 0 ? "" : "opacity-70"}`}
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

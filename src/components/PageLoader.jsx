/**
 * Loader bertema sekolah: logo berdenyut di tengah dua cincin (hijau & kuning) yang berputar
 * berlawanan arah, plus teks "Memuat …" dengan titik bergerak.
 * - fullScreen: menutupi seluruh layar (cek sesi login saat web pertama dibuka).
 * - default: menutupi area konten saja (sidebar tetap terlihat) saat pindah menu.
 */
export default function PageLoader({ label = "Memuat", fullScreen = false }) {
  const logo = `${import.meta.env.BASE_URL}logodhakar.png`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${fullScreen ? "fixed inset-0 z-[90] bg-gradient-to-br from-school-950 via-school-900 to-school-800" : "absolute inset-0 z-20 rounded-t-[24px] bg-white/85 backdrop-blur-[2px]"} animate-school-fade-in flex justify-center`}
    >
      {/* sticky: tetap di tengah layar walau halaman panjang. */}
      <div className={`${fullScreen ? "self-center" : "sticky top-[28vh] self-start pt-6"} flex flex-col items-center gap-4`}>
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 112 112" className="animate-school-spin absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="56" cy="56" r="52" fill="none" stroke={fullScreen ? "rgba(255,255,255,0.15)" : "#dcefe9"} strokeWidth="6" />
            <circle cx="56" cy="56" r="52" fill="none" stroke={fullScreen ? "#34d399" : "#006a52"} strokeWidth="6"
              strokeLinecap="round" strokeDasharray="90 237" />
          </svg>
          <svg viewBox="0 0 112 112" className="animate-school-spin-reverse absolute inset-[11px] h-[90px] w-[90px]" aria-hidden="true">
            <circle cx="45" cy="45" r="41" fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" strokeDasharray="40 218"
              transform="translate(11 11)" />
          </svg>
          <img src={logo} alt="" aria-hidden="true" className="animate-school-pulse absolute inset-[26px] h-[60px] w-[60px] object-contain" />
        </div>
        <p className={`flex items-baseline text-sm font-semibold ${fullScreen ? "text-white" : "text-school-900"}`}>
          {label}
          <span aria-hidden="true" className="ml-0.5 inline-flex">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="animate-school-dot" style={{ animationDelay: `${dot * 0.15}s` }}>.</span>
            ))}
          </span>
        </p>
      </div>
    </div>
  );
}

/** Bar progres tipis di paling atas layar (hijau sekolah → kuning). */
export function TopProgressBar() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[95] h-1 overflow-hidden">
      <div className="animate-school-progress h-full w-full bg-gradient-to-r from-emerald-400 via-school-800 to-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.7)]" />
    </div>
  );
}

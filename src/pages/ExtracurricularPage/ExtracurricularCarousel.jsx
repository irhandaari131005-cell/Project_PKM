import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Images, LoaderCircle, Pause, Play, RefreshCw } from "lucide-react";
import { getActivityError } from "../../services/activityApi.js";
import { extracurricularApi } from "../../services/extracurricular.js";

export default function ExtracurricularCarousel({ revision = 0, paused = false }) {
  const [gallery, setGallery] = useState({ photos: [], loading: true, error: null });
  const [retry, setRetry] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hovering, setHovering] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [broken, setBroken] = useState({});
  const touch = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setGallery({ photos: [], loading: true, error: null });
    extracurricularApi.getPhotos({ signal: controller.signal }).then((photos) => {
      if (controller.signal.aborted) return;
      setIndex(0);
      setBroken({});
      setGallery({ photos, loading: false, error: null });
    }).catch((error) => {
      if (!controller.signal.aborted) setGallery({ photos: [], loading: false, error: getActivityError(error) });
    });
    return () => controller.abort();
  }, [revision, retry]);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const count = gallery.photos.length;
  const activeIndex = count ? index % count : 0;
  const autoPlaying = playing && !paused && !hovering && !focusPaused && !hidden && count > 1;
  useEffect(() => {
    if (!autoPlaying) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % count), 5000);
    return () => window.clearTimeout(timer);
  }, [autoPlaying, count, activeIndex]);

  function move(direction) { setIndex((value) => (value + direction + count) % count); }
  const photo = gallery.photos[activeIndex];
  return (
    <section aria-label="Foto kegiatan ekstrakurikuler" aria-roledescription="carousel" className="overflow-hidden rounded-2xl border border-emerald-900/20 bg-emerald-50 shadow-sm"
      onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocusPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusPaused(false); }}>
      <div className="relative aspect-[2/1] touch-pan-y overflow-hidden md:aspect-[5/2] lg:aspect-[3/1]"
        onPointerDown={(event) => { if (event.isPrimary) touch.current = { x: event.clientX, y: event.clientY }; }}
        onPointerCancel={() => { touch.current = null; }}
        onPointerUp={(event) => {
          if (touch.current && count > 1) {
            const distance = event.clientX - touch.current.x;
            if (Math.abs(distance) > 40 && Math.abs(distance) > Math.abs(event.clientY - touch.current.y)) move(distance < 0 ? 1 : -1);
          }
          touch.current = null;
        }}>
        {gallery.loading ? <div role="status" className="flex h-full items-center justify-center gap-2 text-xs text-emerald-900"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Memuat foto kegiatan...</div> : gallery.error ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-xs text-emerald-950"><Images size={26} aria-hidden="true" /><p>{gallery.error.message}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="flex items-center gap-1 rounded-md bg-white px-3 py-2 font-semibold"><RefreshCw size={12} aria-hidden="true" />Coba lagi foto</button></div> : !photo ? <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center"><Images size={30} className="text-emerald-700" aria-hidden="true" /><p className="text-sm font-bold">Foto kegiatan ekstrakurikuler</p><p className="max-w-[270px] text-[11px] leading-relaxed text-emerald-900/80">Tambahkan foto melalui form Tambah Ekstrakurikuler untuk mengisi carousel ini.</p></div> : <>
          <div className="flex h-full transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {gallery.photos.map((item, position) => <div key={`${item.id}-${item.url}-${position}`} aria-hidden={position !== activeIndex ? "true" : undefined} role="group" aria-roledescription="slide" aria-label={`${position + 1} dari ${count}`} className="h-full w-full shrink-0">
            {broken[item.url] ? <div className="flex h-full flex-col items-center justify-center gap-2 pb-8 text-xs text-emerald-900"><ImageOff size={25} aria-hidden="true" />Foto belum dapat ditampilkan</div> : <img src={item.url} alt={item.caption || "Kegiatan ekstrakurikuler siswa"} loading={position === 0 ? "eager" : "lazy"} draggable={false} onError={() => setBroken((value) => ({ ...value, [item.url]: true }))} className="h-full w-full object-cover" />}
          </div>)}
          </div>
          {photo.caption && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 text-sm font-semibold text-white"><p className="truncate">{photo.caption}</p></div>}
          {count > 1 && <>
            <button type="button" aria-label="Foto sebelumnya" onClick={() => move(-1)} className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ChevronLeft size={22} /></button>
            <button type="button" aria-label="Foto berikutnya" onClick={() => move(1)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ChevronRight size={22} /></button>
          </>}
        </>}
      </div>
      {count > 0 && <div className="flex min-h-9 items-center justify-between gap-2 bg-white px-3 py-1.5">
        <p aria-live={autoPlaying ? "off" : "polite"} aria-atomic="true" className="text-[10px] text-emerald-900">Foto {activeIndex + 1} / {count}</p>
        {count > 1 && <>
          <div className="flex items-center gap-1" aria-label="Pilih foto">
            {gallery.photos.map((item, position) => <button key={`${item.id}-${position}`} type="button" aria-label={`Lihat foto ${position + 1}`} aria-current={position === activeIndex ? "true" : undefined} onClick={() => setIndex(position)} className="flex h-7 w-7 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-emerald-700"><span className={`h-1.5 rounded-full ${position === activeIndex ? "w-4 bg-[#005343]" : "w-1.5 bg-emerald-900/25"}`} /></button>)}
          </div>
          <button type="button" aria-label={playing ? "Jeda carousel" : "Putar carousel"} onClick={() => {
            setPlaying(!playing);
            if (!playing) setFocusPaused(false);
          }} className="rounded-md p-1.5 text-emerald-900 hover:bg-emerald-50">{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        </>}
      </div>}
    </section>
  );
}

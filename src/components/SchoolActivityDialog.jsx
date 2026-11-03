import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, Pencil, X } from "lucide-react";
import { classesApi } from "../services/classes.js";
import { attendanceHistoryApi } from "../services/attendanceHistory.js";
import { getActivityError } from "../services/activityApi.js";
import { ActivityError, ActivityFacts, ActivityLoading } from "./SchoolActivityContent.jsx";
import ActivityPhotosInput from "./ActivityPhotosInput.jsx";

const controlClass = "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20";

export default function ActivityDialog({ config, initialMode, id, onClose, onSaved }) {
  const [mode, setMode] = useState(initialMode);
  const [record, setRecord] = useState(null);
  const [values, setValues] = useState(config.initialValues);
  const [detail, setDetail] = useState({ loading: Boolean(id), error: null });
  const [options, setOptions] = useState({ loading: true, error: null, teachers: [], classes: [] });
  const [detailRevision, setDetailRevision] = useState(0);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(null), dialog = useRef(null), close = useRef(onClose);
  close.current = onClose;
  const editing = mode !== "detail";

  useEffect(() => {
    const previousFocus = document.activeElement, previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.focus();
    function handleKey(event) {
      if (event.key === "Escape") { event.preventDefault(); if (!pending.current) close.current(); }
      if (event.key === "Tab") {
        const controls = [...dialog.current.querySelectorAll("button, input, select, textarea")].filter((element) => !element.matches(":disabled"));
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); dialog.current.focus(); }
        else if (event.shiftKey && [first, dialog.current].includes(document.activeElement)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && [last, dialog.current].includes(document.activeElement)) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      pending.current?.abort();
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setDetail({ loading: true, error: null });
    config.api.detail(id, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setRecord(result.record);
      setValues(config.toValues(config.view(result.record)));
      setDetail({ loading: false, error: null });
    }).catch((requestError) => {
      if (!controller.signal.aborted) setDetail({ loading: false, error: getActivityError(requestError) });
    });
    return () => controller.abort();
  }, [config, id, detailRevision]);

  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    setOptions({ loading: true, error: null, teachers: [], classes: [] });
    async function load() {
      const results = await Promise.allSettled([
        classesApi.getTeachers({ signal: controller.signal }),
        config.withClass ? attendanceHistoryApi.getClasses({ signal: controller.signal }) : Promise.resolve([]),
      ]);
      if (controller.signal.aborted) return;
      const failure = results.find((result) => result.status === "rejected");
      setOptions({ loading: false, error: failure ? getActivityError(failure.reason) : null,
        teachers: results[0].status === "fulfilled" ? results[0].value : [],
        classes: results[1].status === "fulfilled" ? results[1].value : [],
      });
    }
    load();
    return () => controller.abort();
  }, [config.withClass, editing, optionsRevision]);

  useEffect(() => {
    if (editing && !detail.loading && !detail.error) dialog.current?.querySelector("input, select")?.focus();
  }, [editing, detail.loading, detail.error]);

  const item = record ? config.view(record) : null;
  async function submit(event) {
    event.preventDefault();
    if (pending.current || detail.loading || detail.error || options.loading || options.error) return;
    if (!event.currentTarget.reportValidity()) return;
    const controller = new AbortController();
    pending.current = controller;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "create") await config.api.create(values, { signal: controller.signal });
      else await config.api.update(id, values, { signal: controller.signal });
      if (controller.signal.aborted) return;
      pending.current = null;
      setSubmitting(false);
      onSaved(mode === "create");
    } catch (requestError) {
      if (!controller.signal.aborted) { pending.current = null; setSubmitting(false); setError(getActivityError(requestError, "save")); }
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={(event) => { if (event.target === event.currentTarget && !pending.current) onClose(); }}>
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${config.key}-dialog-title`} tabIndex={-1} className="max-h-[calc(100dvh-32px)] w-full max-w-[398px] overflow-y-auto rounded-2xl bg-white p-5 text-[#003D32] shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 id={`${config.key}-dialog-title`} className="min-w-0 text-xl font-bold">{mode === "create" ? "Tambah" : mode === "edit" ? "Edit" : "Detail"} {config.title}</h2>
          <button type="button" aria-label={`Tutup ${config.title}`} disabled={submitting} onClick={onClose} className="shrink-0 rounded-lg p-1 hover:bg-emerald-50 disabled:opacity-40"><X size={22} /></button>
        </div>
        {detail.loading ? <ActivityLoading /> : detail.error ? <ActivityError message={detail.error.message} onRetry={() => setDetailRevision((value) => value + 1)} /> : !editing && item ? <>
          <div className="rounded-xl bg-[#005343] p-4 text-white"><config.Icon size={28} aria-hidden="true" /><h3 className="mt-2 break-words text-xl font-bold">{item.title}</h3><ActivityFacts item={item} withClass={config.withClass} /></div>
          {item.photos?.length > 0 && <div aria-label="Foto kegiatan tersimpan" className="mt-4 grid grid-cols-2 gap-2">{item.photos.map((photo, position) => <img key={`${photo.id}-${position}`} src={photo.url} alt={photo.caption || `Foto kegiatan ${position + 1}`} className="aspect-[2/1] w-full rounded-lg object-cover" />)}</div>}
          {item.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.description}</p>}
          {item.status && <p className="mt-3 text-xs">Status: {item.status === "ACTIVE" ? "Aktif" : item.status === "INACTIVE" ? "Nonaktif" : item.status}</p>}
          <button type="button" onClick={() => setMode("edit")} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#005343] px-4 py-3 text-sm text-white hover:bg-[#003D32]"><Pencil size={15} aria-hidden="true" />Edit {config.title}</button>
        </> : <form onSubmit={submit} aria-busy={submitting}>
          <fieldset disabled={submitting} className="space-y-4">
            {config.fields.map((field) => {
              const inputId = `${config.key}-${field.name}`;
              const choices = field.source ? [...options[field.source]] : [...(field.options || [])];
              const currentName = item && field.currentName?.(item);
              if (field.type === "select" && values[field.name] && !choices.some((choice) => choice.id === values[field.name])) choices.push({ id: values[field.name], name: currentName || "Pilihan saat ini" });
              const props = { id: inputId, name: field.name, required: field.required || Boolean(field.source && currentName && item && !config.toValues(item)[field.name]), value: values[field.name], onChange: (event) => setValues((previous) => ({ ...previous, [field.name]: event.target.value })), "aria-invalid": Boolean(error?.fields[field.name]), "aria-describedby": error?.fields[field.name] ? `${inputId}-error` : undefined, className: controlClass };
              return <div key={field.name}>
                <label htmlFor={inputId} className="mb-1 block text-xs font-semibold">{field.label}{field.required ? "" : " (opsional)"}</label>
                {field.type === "photos" ? <ActivityPhotosInput id={inputId} files={values.foto} existingPhotos={item?.photos || []} removedIds={values.hapus_foto} disabled={submitting}
                  error={error?.fields.foto} onChange={({ files, removedIds }) => setValues((previous) => ({ ...previous, foto: files, hapus_foto: removedIds }))} /> : field.type === "select" ? <select {...props} disabled={Boolean(field.source && (options.loading || options.error))}>
                  <option value="">{field.source && options.loading ? "Memuat pilihan..." : field.required ? `Pilih ${field.label.toLowerCase()}` : "Belum ditentukan"}</option>
                  {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
                </select> : field.type === "textarea" ? <textarea {...props} rows={3} /> : <input {...props} type={field.type || "text"} step={field.type === "time" ? 60 : undefined} autoComplete="off" />}
                {field.type !== "photos" && error?.fields[field.name] && <p id={`${inputId}-error`} className="mt-1 text-xs text-red-700">{error.fields[field.name]}</p>}
              </div>;
            })}
          </fieldset>
          {options.loading && <p role="status" className="mt-3 text-xs text-slate-500">Memuat pilihan guru{config.withClass ? " dan kelas" : ""}...</p>}
          {options.error && <div className="mt-3"><ActivityError message={`Pilihan form: ${options.error.message}`} onRetry={() => setOptionsRevision((value) => value + 1)} /></div>}
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-800">{Object.entries(error.fields).some(([field]) => !config.fields.some((item) => item.name === field)) ? Object.values(error.fields).join(" ") : error.message}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" disabled={submitting} onClick={onClose} className="rounded-lg border border-emerald-900/30 px-4 py-2 text-sm disabled:opacity-50">Batal</button>
            <button type="submit" disabled={submitting || options.loading || Boolean(options.error)} className="flex items-center gap-2 rounded-lg bg-[#005343] px-4 py-2 text-sm text-white hover:bg-[#003D32] disabled:opacity-50">{submitting && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}{submitting ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>}
      </section>
    </div>, document.body,
  );
}

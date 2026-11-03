import { useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { MAX_ACTIVITY_PHOTOS, PHOTO_HINT, validatePhotoFiles } from "../services/extracurricularPhotos.js";

export default function ActivityPhotosInput({ id, files, existingPhotos, removedIds, disabled, onChange, error }) {
  const [previews, setPreviews] = useState([]);
  const [selectionError, setSelectionError] = useState("");
  const input = useRef(null);
  const keptPhotos = existingPhotos.filter((photo) => !removedIds.includes(photo.id));

  useEffect(() => {
    const items = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(items);
    return () => items.forEach((item) => URL.revokeObjectURL(item.url));
  }, [files]);

  function change(nextFiles, nextRemoved = removedIds) {
    input.current.value = "";
    input.current.setCustomValidity("");
    setSelectionError("");
    onChange({ files: nextFiles, removedIds: nextRemoved });
  }
  function select(event) {
    try {
      const selected = [...event.target.files];
      if (!selected.length) return;
      const nextFiles = validatePhotoFiles([...files, ...selected]);
      if (keptPhotos.length + nextFiles.length > MAX_ACTIVITY_PHOTOS) throw new Error("Maksimal 5 foto per kegiatan. Hapus salah satu foto sebelum menambahkan foto baru.");
      change(nextFiles);
    } catch (requestError) {
      const message = requestError.response?.data?.errors?.foto?.[0] || requestError.message;
      setSelectionError(message);
      input.current.value = "";
      input.current.setCustomValidity(message);
    }
  }
  return <div>
    {/* Foto biasa untuk carousel: .webp/.jpg/.jpeg, 1200 x 600 px (2:1), target 150–300 KB. */}
    <p id={`${id}-hint`} className="mb-2 text-xs leading-relaxed text-slate-500">{PHOTO_HINT}</p>
    <input ref={input} id={id} name="foto[]" type="file" multiple accept="image/webp,image/jpeg,.webp,.jpg,.jpeg" disabled={disabled} onChange={select}
      aria-invalid={Boolean(selectionError || error)} aria-describedby={`${id}-hint${selectionError || error ? ` ${id}-error` : ""}`}
      className="block w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#003D32] disabled:opacity-50" />
    {(selectionError || error) && <div className="mt-2">
      <p id={`${id}-error`} role="alert" className="text-xs text-red-700">{selectionError || error}</p>
      {selectionError && <button type="button" disabled={disabled} onClick={() => change(files)} className="mt-1 text-xs font-semibold underline">Batalkan pilihan yang tidak valid</button>}
    </div>}
    <div aria-label="Preview foto kegiatan" className="mt-3 grid grid-cols-2 gap-2">
      {keptPhotos.map((photo, index) => <div key={`${photo.id}-${photo.url}`} className="relative overflow-hidden rounded-lg border border-emerald-900/20 bg-emerald-50">
        <img src={photo.url} alt={photo.caption || `Foto tersimpan ${index + 1}`} className="aspect-[2/1] w-full object-cover" />
        {photo.id && <button type="button" aria-label={`Hapus foto tersimpan ${index + 1}`} disabled={disabled} onClick={() => change(files, [...removedIds, photo.id])} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white disabled:opacity-40"><X size={14} /></button>}
      </div>)}
      {previews.map((preview, index) => <div key={preview.url} className="relative overflow-hidden rounded-lg border border-emerald-900/20 bg-emerald-50">
        <img src={preview.url} alt={`Preview ${preview.file.name}`} className="aspect-[2/1] w-full object-cover" />
        <button type="button" aria-label={`Hapus pilihan foto ${index + 1}`} disabled={disabled} onClick={() => change(files.filter((file, position) => position !== index))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white disabled:opacity-40"><X size={14} /></button>
        <p className="truncate px-2 py-1 text-[10px]">{preview.file.name}</p>
      </div>)}
    </div>
    {!keptPhotos.length && !files.length && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><ImagePlus size={15} aria-hidden="true" />Foto yang ditambahkan akan tampil di carousel.</p>}
    {removedIds.length > 0 && <button type="button" disabled={disabled || existingPhotos.length + files.length > MAX_ACTIVITY_PHOTOS} onClick={() => change(files, [])} className="mt-2 flex items-center gap-1 text-xs font-semibold disabled:opacity-40"><RotateCcw size={13} aria-hidden="true" />Batalkan penghapusan foto</button>}
    <p className="mt-2 text-[11px] text-slate-500">{keptPhotos.length + files.length}/{MAX_ACTIVITY_PHOTOS} foto. Perubahan foto disimpan setelah menekan Simpan.</p>
  </div>;
}

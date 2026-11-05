import { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, Pencil, RefreshCw, Trash2, UserRound } from "lucide-react";
import { getProfileView } from "../DashboardPage/dashboardData.js";
import {
  PROFILE_PHOTO_HINT,
  getProfileError,
  getProfileFormValues,
  profileApi,
  validateProfilePhoto,
} from "../../services/profile.js";

const inputClass =
  "h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:bg-gray-100";

/**
 * Halaman "Profil Saya": lihat dan ubah profil sendiri (guru & siswa).
 * Data diambil dari /api/profile; SN, tipe, dan status hanya ditampilkan.
 */
export default function Profile({ profile: sessionProfile = {}, onProfileUpdated }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));
    profileApi.get({ signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setState({ loading: false, error: null, data }); })
      .catch((error) => { if (!controller.signal.aborted) setState({ loading: false, error: getProfileError(error), data: null }); });
    return () => controller.abort();
  }, [revision]);

  // Selama memuat, tampilkan data sesi (nama/tipe) agar halaman tidak kosong.
  const user = getProfileView(state.data ?? sessionProfile);

  function handleSaved(data) {
    setState({ loading: false, error: null, data });
    setEditing(false);
    setSuccess("Profil berhasil diperbarui.");
    onProfileUpdated?.(data);
  }

  return (
    <section className="relative min-h-full rounded-xl bg-white px-3 pb-4 pt-0 text-[#003D32]">
      <section className="relative z-10 -mt-1 rounded-[20px] border border-gray-200 bg-white px-3 py-3 text-center shadow-[0_2px_4px_rgba(0,0,0,0.22)]">
        <h1 className="text-[23px] font-bold leading-tight">{editing ? "Edit Profil" : "Profil Saya"}</h1>
        <p className="text-[10px]">Kelola informasi data diri Anda</p>
      </section>

      {state.loading && !state.data && (
        <p role="status" className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600">
          <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Memuat profil...
        </p>
      )}
      {state.error && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-center text-xs text-red-800">
          <p>{state.error.message}</p>
          <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#003D32] px-3 py-1 text-white">
            <RefreshCw size={12} aria-hidden="true" /> Coba lagi
          </button>
        </div>
      )}
      {success && !editing && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-2 text-center text-xs text-emerald-900">{success}</p>}

      {editing && state.data ? (
        <ProfileForm profile={state.data} onCancel={() => setEditing(false)} onSaved={handleSaved} />
      ) : (
        <ProfileDetails user={user} />
      )}

      {!editing && state.data && (
        <button
          type="button"
          onClick={() => { setSuccess(""); setEditing(true); }}
          className="mt-6 flex w-full items-center justify-center gap-1 rounded-sm bg-[#003D32] py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-[#005343]"
        >
          <Pencil size={11} aria-hidden="true" />
          Edit Profil
        </button>
      )}
    </section>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="text-center">
      <h2 className="inline-flex rounded-full bg-[#005343] px-3 py-1 text-sm font-bold text-white">{children}</h2>
    </div>
  );
}

function Avatar({ src, size = 84 }) {
  const [failed, setFailed] = useState(null);
  const style = { width: size, height: size };
  return src && failed !== src ? (
    <img src={src} alt="Foto profil" onError={() => setFailed(src)} style={style} className="rounded-full border-2 border-gray-300 object-cover" />
  ) : (
    <span style={style} className="flex items-center justify-center rounded-full bg-school-100">
      <UserRound size={Math.round(size / 2)} aria-label="Foto profil belum tersedia" />
    </span>
  );
}

function ProfileDetails({ user }) {
  return (
    <>
      <section className="mt-[-9px]">
        <div className="pt-3"><SectionTitle>Informasi Pribadi</SectionTitle></div>
        <div className="mt-5 flex justify-center"><Avatar src={user.photo} /></div>
        <div className="mt-4 space-y-1 text-[10px]">
          <ProfileRow label="Nomor Identitas" value={user.identifier} />
          <ProfileRow label="Nama" value={user.name} />
          <ProfileRow label="Tempat tanggal lahir" value={user.birthDate} />
          <ProfileRow label="Tipe" value={user.typeLabel} />
          {user.type === "siswa" && <ProfileRow label="Kelas" value={user.className} />}
          <ProfileRow label="Status" value={user.status} />
        </div>
      </section>
      <section className="mt-3">
        <SectionTitle>Informasi Kontak</SectionTitle>
        <div className="mt-2 space-y-1 text-[10px]">
          <ProfileRow label="Alamat" value={user.address} />
          <ProfileRow label="No Telp" value={user.phone} />
        </div>
      </section>
    </>
  );
}

function ProfileRow({ label, value }) {
  return (
    <div className="grid grid-cols-[80px_8px_1fr] items-start gap-1">
      <span>{label}</span>
      <span>:</span>
      <span className="whitespace-pre-line break-words">{value || "-"}</span>
    </div>
  );
}

function ProfileForm({ profile, onCancel, onSaved }) {
  const [values, setValues] = useState(() => getProfileFormValues(profile));
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState("");
  const request = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!values.foto) { setPreview(""); return undefined; }
    const url = URL.createObjectURL(values.foto);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [values.foto]);

  const currentPhoto = preview || (values.hapus_foto ? "" : profile.foto_url);
  const fieldError = (name) => error?.fields?.[name];

  function set(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  function choosePhoto(event) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    const message = validateProfilePhoto(file);
    if (message) {
      setError({ message: "Periksa kembali foto yang dipilih.", fields: { foto: message } });
      return;
    }
    setError(null);
    setValues((previous) => ({ ...previous, foto: file, hapus_foto: false }));
  }

  function removePhoto() {
    setValues((previous) => ({ ...previous, foto: null, hapus_foto: Boolean(profile.foto_url) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const controller = new AbortController();
    request.current = controller;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await profileApi.update(values, { signal: controller.signal });
      if (!controller.signal.aborted) onSaved(saved);
    } catch (caught) {
      if (!controller.signal.aborted) setError(getProfileError(caught, "save"));
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
      request.current = null;
    }
  }

  const fields = [
    { name: "nama", label: "Nama", required: true, autoComplete: "name", maxLength: 100 },
    { name: "tempat_lahir", label: "Tempat lahir", maxLength: 100 },
    { name: "tanggal_lahir", label: "Tanggal lahir", type: "date", max: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()), min: "1900-01-01" },
    { name: "no_telp", label: "No telp", type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "08xxxxxxxxxx", maxLength: 20 },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3 text-[11px]" aria-busy={submitting}>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-center text-xs text-red-800">{error.message}</p>}

      <div className="flex flex-col items-center gap-2">
        <Avatar src={currentPhoto} />
        <div className="flex gap-2">
          <button type="button" disabled={submitting} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-[#003D32] px-2 py-1 text-[10px] font-semibold hover:bg-emerald-50 disabled:opacity-50">
            <Camera size={12} aria-hidden="true" /> {currentPhoto ? "Ganti foto" : "Pilih foto"}
          </button>
          {currentPhoto && (
            <button type="button" disabled={submitting} onClick={removePhoto} className="inline-flex items-center gap-1 rounded-md border border-red-700 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              <Trash2 size={12} aria-hidden="true" /> Hapus foto
            </button>
          )}
        </div>
        <input ref={fileInput} id="profile-photo" type="file" accept="image/jpeg,image/webp,.jpg,.jpeg,.webp" onChange={choosePhoto} className="sr-only" aria-label="Pilih foto profil" aria-describedby="profile-photo-hint" />
        <p id="profile-photo-hint" className="text-center text-[9px] text-slate-500">{PROFILE_PHOTO_HINT}</p>
        {fieldError("foto") && <p className="text-center text-xs text-red-700">{fieldError("foto")}</p>}
      </div>

      <ReadOnlyRow label="Nomor Identitas" value={profile.sn} note="Hubungi admin sekolah untuk mengubah." />

      {fields.map(({ name, label, required, ...props }) => (
        <div key={name}>
          <label htmlFor={`profile-${name}`} className="mb-1 block">{label}{required && <span className="text-red-600"> *</span>}</label>
          <input
            id={`profile-${name}`}
            type={props.type || "text"}
            {...props}
            required={required}
            disabled={submitting}
            value={values[name]}
            onChange={(event) => set(name, event.target.value)}
            aria-invalid={Boolean(fieldError(name))}
            aria-describedby={fieldError(name) ? `profile-${name}-error` : undefined}
            className={inputClass}
          />
          {fieldError(name) && <p id={`profile-${name}-error`} className="mt-1 text-xs text-red-700">{fieldError(name)}</p>}
        </div>
      ))}

      <div>
        <label htmlFor="profile-alamat" className="mb-1 block">Alamat</label>
        <textarea
          id="profile-alamat"
          rows={3}
          maxLength={255}
          disabled={submitting}
          value={values.alamat}
          onChange={(event) => set("alamat", event.target.value)}
          aria-invalid={Boolean(fieldError("alamat"))}
          aria-describedby={fieldError("alamat") ? "profile-alamat-error" : undefined}
          className={`${inputClass} h-auto py-1.5`}
        />
        {fieldError("alamat") && <p id="profile-alamat-error" className="mt-1 text-xs text-red-700">{fieldError("alamat")}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={submitting} className="rounded-sm border border-[#003D32] py-1.5 text-[10px] font-semibold hover:bg-emerald-50 disabled:opacity-50">Batal</button>
        <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-1 rounded-sm bg-[#003D32] py-1.5 text-[10px] font-semibold text-white hover:bg-[#005343] disabled:opacity-60">
          {submitting && <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />}
          {submitting ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}

function ReadOnlyRow({ label, value, note }) {
  return (
    <div>
      <p className="mb-1">{label}</p>
      <p className="rounded-md border border-gray-200 bg-gray-100 px-2 py-1.5 text-xs text-gray-700">{value || "-"}</p>
      <p className="mt-0.5 text-[9px] text-slate-500">{note}</p>
    </div>
  );
}

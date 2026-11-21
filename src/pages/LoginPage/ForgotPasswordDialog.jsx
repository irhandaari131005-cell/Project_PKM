import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, LoaderCircle, X } from "lucide-react";
import { forgotPassword, getForgotPasswordError } from "../../services/auth.js";

const inputClass =
  "h-11 w-full rounded-md border border-transparent bg-[#eaeaea] px-3 text-sm text-slate-900 outline-none transition focus:border-[#009c87] focus:ring-2 focus:ring-[#59c0b4]/30";

/**
 * Reset password tanpa login: cocokkan username + nomor kartu (SN) yang dipakai saat registrasi
 * (PATCH /api/forgot_password). Setelah berhasil, pengguna login dengan password baru.
 */
export default function ForgotPasswordDialog({ initialUsername = "", onClose, onReset }) {
  const [values, setValues] = useState({ username: initialUsername, sn: "", newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(null);
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector(values.username ? "#forgot-sn" : "#forgot-username")?.focus();
    function handleKey(event) {
      if (event.key === "Escape" && !pending.current) {
        event.preventDefault();
        close.current();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      pending.current?.abort();
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
    // Fokus awal cukup sekali saat dialog dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(values, { signal: controller.signal });
      if (controller.signal.aborted) return;
      pending.current = null;
      onReset(values.username.trim());
    } catch (caught) {
      if (!controller.signal.aborted) {
        pending.current = null;
        setSubmitting(false);
        setError(getForgotPasswordError(caught));
      }
    }
  }

  const fieldError = (name) => (error?.field === name ? error.message : "");
  const fields = [
    { name: "username", label: "Username", autoComplete: "username", type: "text" },
    { name: "sn", label: "Nomor kartu (SN)", autoComplete: "off", type: "text", hint: "Nomor kartu yang dipakai saat mendaftar." },
    { name: "newPassword", label: "Password baru", autoComplete: "new-password", type: showPassword ? "text" : "password", hint: "Minimal 8 karakter." },
    { name: "confirmPassword", label: "Konfirmasi password baru", autoComplete: "new-password", type: showPassword ? "text" : "password" },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending.current) onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-password-title"
        aria-describedby="forgot-password-description"
        className="max-h-[calc(100dvh-32px)] w-full max-w-[380px] overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 id="forgot-password-title" className="text-xl font-bold text-[#003e30]">Lupa Password</h2>
          <button type="button" aria-label="Tutup lupa password" disabled={submitting} onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 disabled:opacity-40">
            <X size={22} />
          </button>
        </div>
        <p id="forgot-password-description" className="mb-4 text-xs leading-relaxed text-slate-600">
          Masukkan username dan nomor kartu (SN) yang dipakai saat mendaftar, lalu buat password baru.
        </p>
        <form onSubmit={submit} noValidate aria-busy={submitting}>
          <fieldset disabled={submitting} className="space-y-3">
            {fields.map(({ name, label, hint, ...props }) => {
              const id = `forgot-${name}`;
              const message = fieldError(name);
              return (
                <div key={name}>
                  <label htmlFor={id} className="mb-1 block text-[13px]">{label}</label>
                  <input
                    id={id}
                    name={name}
                    required
                    autoCapitalize="none"
                    spellCheck={false}
                    value={values[name]}
                    onChange={(event) => set(name, event.target.value)}
                    aria-invalid={Boolean(message)}
                    aria-describedby={message ? `${id}-error` : hint ? `${id}-hint` : undefined}
                    className={inputClass}
                    {...props}
                  />
                  {message ? (
                    <p id={`${id}-error`} className="mt-1 text-xs text-red-700">{message}</p>
                  ) : hint ? (
                    <p id={`${id}-hint`} className="mt-1 text-[11px] text-slate-500">{hint}</p>
                  ) : null}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="flex items-center gap-1 text-xs text-[#003e30] underline"
            >
              {showPassword ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              {showPassword ? "Sembunyikan password" : "Tampilkan password"}
            </button>
          </fieldset>
          {error && !error.field && (
            <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">{error.message}</p>
          )}
          {error?.field && <p role="alert" className="sr-only">{error.message}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" disabled={submitting} onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-md bg-[#003e30] px-4 py-2 text-sm text-white hover:bg-[#005343] disabled:opacity-60">
              {submitting && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}
              {submitting ? "Memproses..." : "Reset password"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin } from "lucide-react";
import { APP_ROUTES } from "../../routes.js";
import {
  authApi,
  getLoginError,
  getRegisterError,
  LOGIN_ROLES,
  REGISTER_ROLES,
  normalizeLoginResponse,
} from "../../services/auth.js";

// EDIT DI SINI: teks dan lokasi gambar pada halaman login.
const LOGIN_CONTENT = {
  title: "Selamat Datang",
  schoolName: "SMK Dharma Karya",
  logo: `${import.meta.env.BASE_URL}logodhakar.png`,
  background: `${import.meta.env.BASE_URL}bglogin.png`,
};

export default function Login({ isRegister = false, onNavigate, onSuccess }) {
  const [nama, setNama] = useState("");
  const [type, setType] = useState("guru");
  const [username, setUsername] = useState("");
  const [sn, setSn] = useState("");
  const [idKelas, setIdKelas] = useState("");
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classLoadError, setClassLoadError] = useState("");
  const [classRetryCount, setClassRetryCount] = useState(0);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState({ message: "", fields: {} });
  const [success, setSuccess] = useState("");
  const pendingRequest = useRef(null);
  const registrationCompleted = useRef(false);
  const roles = isRegister ? REGISTER_ROLES : LOGIN_ROLES;
  const requiresClass = isRegister && type === "siswa";
  const classSelectionUnavailable = requiresClass && (loadingClasses || Boolean(classLoadError) || classes.length === 0);

  useEffect(() => () => pendingRequest.current?.abort(), []);

  useEffect(() => {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    setSubmitting(false);
    setPassword("");
    setPasswordConfirmation("");
    setIdKelas("");
    setError({ message: "", fields: {} });
    setType((current) => isRegister && !REGISTER_ROLES.some((role) => role.value === current)
      ? REGISTER_ROLES[0].value
      : current);
    setSuccess(!isRegister && registrationCompleted.current
      ? "Registrasi berhasil. Silakan login menggunakan akun baru Anda."
      : "");
    registrationCompleted.current = false;
  }, [isRegister]);

  useEffect(() => {
    if (!requiresClass) return;
    const controller = new AbortController();
    setLoadingClasses(true);
    setClassLoadError("");
    authApi.getClasses({ signal: controller.signal })
      .then((options) => {
        if (controller.signal.aborted) return;
        setClasses(options);
        setIdKelas((current) => options.some((option) => option.id === current) ? current : "");
      })
      .catch(() => {
        if (!controller.signal.aborted) setClassLoadError("Daftar kelas belum dapat dimuat. Silakan coba lagi.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingClasses(false);
      });
    return () => controller.abort();
  }, [requiresClass, classRetryCount]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (pendingRequest.current) return;

    const controller = new AbortController();
    pendingRequest.current = controller;
    setSubmitting(true);
    setError({ message: "", fields: {} });
    setSuccess("");

    try {
      if (isRegister) {
        // authApi.register() sudah memakai Axios dari services/api.js.
        await authApi.register(
          {
            nama,
            username,
            sn,
            type,
            id_kelas: idKelas,
            password,
            password_confirmation: passwordConfirmation,
          },
          { signal: controller.signal },
        );

        if (controller.signal.aborted) return;
        setNama("");
        setSn("");
        setIdKelas("");
        setPasswordConfirmation("");
        registrationCompleted.current = true;

        onNavigate(APP_ROUTES.login, { replace: true });
      } else {
        const payload = await authApi.login(
          { username, password, type },
          { signal: controller.signal },
        );

        if (controller.signal.aborted) return;

        const session = normalizeLoginResponse(payload);
        await onSuccess(session);
      }

      if (!controller.signal.aborted) setPassword("");
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(isRegister ? getRegisterError(requestError) : getLoginError(requestError));
      }
    } finally {
      if (pendingRequest.current === controller) pendingRequest.current = null;
      if (!controller.signal.aborted) setSubmitting(false);
    }
  }

  return (
    // HP: banner di atas + kartu form. Tablet/desktop (md): dua kolom, banner kiri setinggi layar, form kanan.
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#babfbc] sm:min-h-[860px] sm:shadow-2xl md:min-h-dvh md:max-w-none md:flex-row md:bg-white md:shadow-none">
      {/* EDIT BANNER: tinggi, overlay warna, logo, dan judul sistem. */}
      <header
        aria-label="Sistem Absensi Digital"
        className="relative aspect-[1.58/1] w-full shrink-0 overflow-hidden rounded-b-2xl bg-[#00645f] md:aspect-auto md:min-h-dvh md:w-1/2 md:rounded-none lg:w-3/5"
      >
        <img
          src={LOGIN_CONTENT.background}
          alt="Ilustrasi lingkungan sekolah"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[#006b66]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#003e35]/90 via-[#003e35]/10 to-transparent" />

        <div className="absolute inset-x-[10%] top-[17%] flex items-center gap-3 md:top-1/2 md:-translate-y-1/2 md:gap-6">
          <img
            src={LOGIN_CONTENT.logo}
            alt={`Logo ${LOGIN_CONTENT.schoolName}`}
            className="w-[42%] shrink-0 object-contain md:w-[38%] md:max-w-[260px]"
          />
          <div className="min-w-0 text-white">
            <p
              className="text-[clamp(25px,8.5vw,38px)] leading-[1.02] drop-shadow-md md:text-[clamp(38px,4.5vw,64px)]"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              <span className="block italic">SISTEM</span>
              <span className="block">ABSENSI</span>
              <span className="block">DIGITAL</span>
            </p>
            <p className="mt-1.5 flex items-center gap-1 whitespace-nowrap text-[clamp(8px,2.4vw,10px)] md:mt-3 md:text-sm">
              <MapPin size={10} aria-hidden="true" /> {LOGIN_CONTENT.schoolName}
            </p>
          </div>
        </div>
      </header>

      {/* EDIT PANEL: ukuran kartu putih dan tulisan Selamat Datang. */}
      <section
        aria-labelledby="login-title"
        className="relative z-10 mx-3 -mt-10 flex min-h-[530px] flex-1 flex-col rounded-t-[28px] bg-white shadow-[0_0_7px_rgba(0,0,0,0.35)] md:m-0 md:min-h-dvh md:justify-center md:overflow-y-auto md:rounded-none md:py-10 md:shadow-none"
      >
        <h1
          id="login-title"
          className="rounded-t-[26px] bg-white px-3 py-4 text-center text-[clamp(29px,8.5vw,42px)] font-bold leading-tight tracking-[-0.8px] text-black shadow-[0_5px_8px_rgba(0,0,0,0.22)] md:mx-auto md:w-full md:max-w-md md:shadow-none"
        >
          {isRegister ? "Selamat Datang" : LOGIN_CONTENT.title}
        </h1>

        {/* EDIT FORM: jarak field, pilihan akun, input, dan tombol LOGIN. */}
        <form
          onSubmit={handleSubmit}
          aria-busy={submitting}
          className="flex flex-1 flex-col px-7 pb-20 pt-8 min-[390px]:px-9 md:mx-auto md:w-full md:max-w-md md:flex-none md:pb-8"
        >
          <fieldset disabled={submitting} className="min-w-0 space-y-5">
            <div>
              <p id="login-role-label" className="mb-3 text-[13px] text-black">
                {isRegister ? "Daftar sebagai :" : "Log In sebagai :"}
              </p>
              <div
                role="group"
                aria-labelledby="login-role-label"
                aria-describedby={
                  error.fields.type ? "login-type-error" : undefined
                }
                className={`grid ${isRegister ? "grid-cols-2" : "grid-cols-2"} gap-1 rounded-[9px] bg-[#d9d9d9] p-1`}
              >
                {roles.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    aria-pressed={type === role.value}
                    onClick={() => {
                      setType(role.value);
                      setError({ message: "", fields: {} });
                    }}
                    className={`h-8 rounded-[7px] border text-[12px] text-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-1 ${
                      type === role.value
                        ? "border-[#009c87] bg-[#59c0b4] shadow-sm"
                        : "border-transparent hover:bg-white/50"
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
              {error.fields.type && (
                <p id="login-type-error" className="mt-1 text-xs text-red-700">
                  {error.fields.type}
                </p>
              )}
            </div>

            {isRegister && (
              <RegistrationField
                name="nama"
                label="Nama lengkap :"
                autoComplete="name"
                value={nama}
                onChange={setNama}
                error={error.fields.nama}
              />
            )}

            <div>
              <label
                htmlFor="login-username"
                className="mb-2 block text-[13px] text-black"
              >
                Username :
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                aria-invalid={Boolean(error.fields.username)}
                aria-describedby={
                  error.fields.username ? "login-username-error" : undefined
                }
                className="h-11 w-full rounded-md border border-transparent bg-[#eaeaea] px-3 text-sm text-slate-900 outline-none transition focus:border-[#009c87] focus:ring-2 focus:ring-[#59c0b4]/30"
              />
              {error.fields.username && (
                <p
                  id="login-username-error"
                  className="mt-1 text-xs text-red-700"
                >
                  {error.fields.username}
                </p>
              )}
            </div>

            {isRegister && (
              <RegistrationField
                name="sn"
                label="Nomor kartu (SN) :"
                autoComplete="off"
                value={sn}
                onChange={setSn}
                error={error.fields.sn}
              />
            )}

            {requiresClass && (
              <div>
                <label htmlFor="register-id_kelas" className="mb-2 block text-[13px] text-black">
                  Kelas :
                </label>
                <select
                  id="register-id_kelas"
                  name="id_kelas"
                  required
                  value={idKelas}
                  disabled={classSelectionUnavailable}
                  onChange={(event) => setIdKelas(event.target.value)}
                  aria-invalid={Boolean(error.fields.id_kelas)}
                  aria-describedby={error.fields.id_kelas ? "register-id_kelas-error" : undefined}
                  className="h-11 w-full rounded-md border border-transparent bg-[#eaeaea] px-3 text-sm text-slate-900 outline-none transition focus:border-[#009c87] focus:ring-2 focus:ring-[#59c0b4]/30 disabled:opacity-60"
                >
                  <option value="">{loadingClasses ? "Memuat kelas..." : "Pilih kelas"}</option>
                  {classes.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
                </select>
                {error.fields.id_kelas && (
                  <p id="register-id_kelas-error" className="mt-1 text-xs text-red-700">{error.fields.id_kelas}</p>
                )}
                {classLoadError && (
                  <div className="mt-2 text-xs text-red-700">
                    <p role="alert">{classLoadError}</p>
                    <button type="button" onClick={() => setClassRetryCount((count) => count + 1)} className="mt-1 rounded-sm text-school-900 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">Coba lagi</button>
                  </div>
                )}
                {!loadingClasses && !classLoadError && classes.length === 0 && (
                  <p role="status" className="mt-1 text-xs text-slate-600">Belum ada kelas yang tersedia. Hubungi admin sekolah.</p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-[13px] text-black"
              >
                Password :
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 8 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error.fields.password)}
                aria-describedby={
                  error.fields.password ? "login-password-error" : undefined
                }
                className="h-11 w-full rounded-md border border-transparent bg-[#eaeaea] px-3 text-sm text-slate-900 outline-none transition focus:border-[#009c87] focus:ring-2 focus:ring-[#59c0b4]/30"
              />
              {error.fields.password && (
                <p
                  id="login-password-error"
                  className="mt-1 text-xs text-red-700"
                >
                  {error.fields.password}
                </p>
              )}
            </div>

            {isRegister && (
              <RegistrationField
                name="password_confirmation"
                label="Konfirmasi password :"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={setPasswordConfirmation}
                error={error.fields.password_confirmation}
              />
            )}
          </fieldset>

          {success && (
            <p
              role="status"
              className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800"
            >
              {success}
            </p>
          )}

          {error.message && (
            <p
              role="alert"
              className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800"
            >
              {error.message}
            </p>
          )}

          <div className="mt-auto flex justify-center pt-24">
            <button
              type="submit"
              disabled={submitting || classSelectionUnavailable}
              className="flex h-[42px] min-w-[145px] items-center justify-center gap-2 rounded-[5px] bg-[#003e30] px-6 text-base text-white transition hover:bg-[#005343] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009c87] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
              style={{ fontFamily: '"Arial Narrow", Impact, sans-serif' }}
            >
              {submitting && (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}
              {submitting ? "MEMPROSES..." : isRegister ? "REGISTER" : "LOGIN"}
            </button>
          </div>

          <p className="mt-4 text-center text-[12px] text-black">
            {isRegister ? "Sudah punya akun? " : "Belum punya akun? "}
            <a
              href={isRegister ? APP_ROUTES.login : APP_ROUTES.register}
              aria-disabled={submitting || undefined}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                if (submitting) return;
                setError({ message: "", fields: {} });
                setSuccess("");
                onNavigate(isRegister ? APP_ROUTES.login : APP_ROUTES.register);
              }}
              className="rounded-sm text-[#0000ff] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              {isRegister ? "LOGIN" : "REGISTER"}
            </a>
          </p>
        </form>
      </section>
    </main>
  );
}

function RegistrationField({
  name,
  label,
  type = "text",
  autoComplete,
  value,
  onChange,
  error,
}) {
  const id = `register-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] text-black">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11 w-full rounded-md border border-transparent bg-[#eaeaea] px-3 text-sm text-slate-900 outline-none transition focus:border-[#009c87] focus:ring-2 focus:ring-[#59c0b4]/30"
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import Dashbord from "./pages/DashboardPage/Dashbord.jsx";
import Login from "./pages/LoginPage/Login.jsx";
import PageLoader from "./components/PageLoader.jsx";
import { authApi, clearAuthSession, saveAuthSession } from "./services/auth.js";
import { APP_ROUTES, getRequestedRoute, resolveAppRoute } from "./routes.js";

function readLocation() {
  return { pathname: window.location.pathname, search: window.location.search };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [location, setLocation] = useState(readLocation);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const sessionRequest = useRef(null);
  const logoutRequest = useRef(null);
  const requestedRoute = getRequestedRoute(location);
  const isPublicRoute = requestedRoute === APP_ROUTES.login || requestedRoute === APP_ROUTES.register;
  const route = resolveAppRoute(location, session);

  const navigate = useCallback((path, { replace = false } = {}) => {
    window.history[replace ? "replaceState" : "pushState"](null, "", path);
    setLocation(readLocation());
  }, []);

  useEffect(() => {
    const handlePopState = () => setLocation(readLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    sessionRequest.current = controller;
    setCheckingSession(true);
    setSessionError(false);

    authApi.me({ signal: controller.signal })
      .then((nextSession) => {
        if (!controller.signal.aborted) setSession(nextSession);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if ((error.response?.status ?? error.status) === 401) {
          clearAuthSession();
          setSession(null);
        } else {
          setSessionError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckingSession(false);
      });

    return () => controller.abort();
  }, [retryCount]);

  useEffect(() => () => logoutRequest.current?.abort(), []);

  useEffect(() => {
    if (!session && !isPublicRoute && (checkingSession || sessionError)) return;
    const url = new URL(window.location.href);
    url.pathname = route;
    url.searchParams.delete("page");
    const destination = `${url.pathname}${url.search}${url.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== destination) {
      navigate(destination, { replace: true });
    }
  }, [route, isPublicRoute, checkingSession, sessionError, session, location, navigate]);

  function handleLogin(nextSession) {
    saveAuthSession(nextSession);
    sessionRequest.current?.abort();
    setSession(nextSession);
    setCheckingSession(false);
    setSessionError(false);
    navigate(APP_ROUTES.dashboard, { replace: true });
  }

  async function handleLogout() {
    if (logoutRequest.current) return;
    const controller = new AbortController();
    logoutRequest.current = controller;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await authApi.logout({ signal: controller.signal });
      if (controller.signal.aborted) return;
      finishLogout();
    } catch (error) {
      if (controller.signal.aborted) return;
      if ((error.response?.status ?? error.status) === 401) finishLogout();
      else setLogoutError("Belum berhasil keluar. Periksa koneksi lalu coba lagi.");
    } finally {
      logoutRequest.current = null;
      if (!controller.signal.aborted) setLoggingOut(false);
    }
  }

  // Nama baru dari "Profil Saya" langsung tampil di header/sidebar tanpa reload.
  // Tipe/izin tetap dari sesi; hanya nama yang disalin dari respons profil.
  function handleProfileUpdated(profile) {
    if (typeof profile?.nama !== "string") return;
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user: { ...current.user, nama: profile.nama } };
      try { saveAuthSession(next); } catch { /* localStorage tidak tersedia: cukup state saja */ }
      return next;
    });
  }

  function finishLogout() {
    sessionRequest.current?.abort();
    clearAuthSession();
    setSession(null);
    setCheckingSession(false);
    setSessionError(false);
    navigate(APP_ROUTES.login, { replace: true });
  }

  if (!session && !isPublicRoute && checkingSession && !sessionError) {
    return <PageLoader fullScreen label="Memeriksa sesi login" />;
  }

  if (!session && !isPublicRoute && sessionError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p role="alert">
          Tidak dapat memeriksa sesi. Periksa koneksi lalu coba lagi.
        </p>
        {sessionError && (
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="rounded-md bg-school-900 px-5 py-2 text-white">
            Coba lagi
          </button>
        )}
      </main>
    );
  }

  return route === APP_ROUTES.dashboard ? (
    <>
      <Dashbord profile={session.user} onLogout={handleLogout} onProfileUpdated={handleProfileUpdated} />
      {(loggingOut || logoutError) && (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-[406px] rounded-md bg-white p-4 text-center shadow-lg">
          <p role={logoutError ? "alert" : "status"}>{logoutError || "Sedang keluar..."}</p>
          {logoutError && (
            <button type="button" onClick={handleLogout} className="mt-2 rounded-md bg-school-900 px-4 py-2 text-white">Coba lagi</button>
          )}
        </div>
      )}
    </>
  ) : (
    <Login isRegister={route === APP_ROUTES.register} onNavigate={navigate} onSuccess={handleLogin} />
  );
}

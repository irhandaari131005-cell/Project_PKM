export const APP_ROUTES = Object.freeze({
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
});

export function getRequestedRoute({ pathname, search = "" }) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") {
    const page = new URLSearchParams(search).get("page");
    if (page === "login" || page === "register") return APP_ROUTES[page];
  }
  return Object.values(APP_ROUTES).includes(path) ? path : null;
}

export function resolveAppRoute(location, session) {
  if (session) return APP_ROUTES.dashboard;
  return getRequestedRoute(location) === APP_ROUTES.register
    ? APP_ROUTES.register
    : APP_ROUTES.login;
}

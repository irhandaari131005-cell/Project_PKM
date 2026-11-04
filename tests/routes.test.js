import test from "node:test";
import assert from "node:assert/strict";
import { APP_ROUTES, getRequestedRoute, resolveAppRoute } from "../src/routes.js";

test("dashboard dan URL awal memerlukan sesi yang sudah divalidasi", () => {
  for (const pathname of ["/", "/dashboard", "/dashboard/", "/tidak-ada"]) {
    assert.equal(resolveAppRoute({ pathname }, null), APP_ROUTES.login);
    assert.equal(resolveAppRoute({ pathname }, { user: { id_user: 1 } }), APP_ROUTES.dashboard);
  }
});

test("login dan registrasi punya route sendiri; pengguna yang sudah login menuju dashboard", () => {
  for (const pathname of ["/login", "/register", "/register/"]) {
    const location = { pathname };
    assert.equal(resolveAppRoute(location, null), pathname.replace(/\/$/, ""));
    assert.equal(resolveAppRoute(location, { user: { id_user: 1 } }), APP_ROUTES.dashboard);
  }
});

test("link lama login/registrasi tetap dikenali tanpa membiarkan query mengganti route dashboard", () => {
  assert.equal(getRequestedRoute({ pathname: "/", search: "?page=login" }), APP_ROUTES.login);
  assert.equal(resolveAppRoute({ pathname: "/", search: "?page=register" }, null), APP_ROUTES.register);
  assert.equal(getRequestedRoute({ pathname: "/dashboard", search: "?page=register" }), APP_ROUTES.dashboard);
  assert.equal(resolveAppRoute({ pathname: "/dashboard", search: "?page=register" }, null), APP_ROUTES.login);
});

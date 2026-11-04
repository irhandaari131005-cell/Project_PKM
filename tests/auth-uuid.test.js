import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLoginResponse } from "../src/services/auth.js";
import { APP_ROUTES, resolveAppRoute } from "../src/routes.js";

test("login UUID dan pemulihan sesi dapat masuk dashboard", () => {
  for (const id of ["47c3f276-a10a-4e3e-a6cd-fb14a305fdeb", "99D183E6-C0FD-4645-BAF7-3E3085DBDF78"]) {
    const user = { id_user: id, username: "budi", nama: "Budi", type: "guru" };
    for (const payload of [
      { status: 200, message: "Login berhasil", redirect: "/dashboard", data: user },
      { status: 200, message: "User terautentikasi", data: user },
    ]) {
      const session = normalizeLoginResponse(payload);
      assert.deepEqual(session, { token: null, user, payload });
      assert.equal(session.user.id_user, id);
      assert.equal(resolveAppRoute({ pathname: "/login" }, session), APP_ROUTES.dashboard);
      assert.equal(resolveAppRoute({ pathname: "/dashboard" }, session), APP_ROUTES.dashboard);
    }
  }
});

test("ID kosong dan UUID rusak tidak menjadi sesi login", () => {
  for (const id of ["", " ", "1", "not-a-uuid", "47c3f276a10a4e3ea6cdfb14a305fdeb", "47c3f276-a10a-4e3e-a6cd-fb14a305fdeZ", null, false, [], {}, 0, -1]) {
    assert.throws(() => normalizeLoginResponse({ status: 200, data: { id_user: id } }));
  }
});

test("profil UUID pada respons gagal tetap ditolak", () => {
  const data = { id_user: "47c3f276-a10a-4e3e-a6cd-fb14a305fdeb" };
  for (const status of [400, 401, 403, 500]) {
    assert.throws(() => normalizeLoginResponse({ status, data }), (error) => error.status === status);
  }
});

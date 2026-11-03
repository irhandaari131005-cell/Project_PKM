import { createActivityApi, readMeetingTime, readText, text, validationError, viewTime } from "./activityApi.js";
import { request } from "./api.js";
import { normalizeHistoryCollection } from "./attendanceHistory.js";
import { MAX_ACTIVITY_PHOTOS, normalizePhotos, prepareExtracurricularWrite } from "./extracurricularPhotos.js";

const env = import.meta.env ?? {};
const ENDPOINT = (env.VITE_EXTRACURRICULAR_ENDPOINT || "/api/ekstrakurikuler").replace(/\/+$/, "");
const PHOTOS_ENDPOINT = env.VITE_EXTRACURRICULAR_PHOTOS_ENDPOINT || `${ENDPOINT}/foto`;

export function buildExtracurricularPayload(values = {}) {
  const errors = {};
  const nama_ekstrakurikuler = readText(values, "nama_ekstrakurikuler", "Nama ekstrakurikuler", errors, true);
  const id_pembina = readText(values, "id_pembina", "Pembina", errors) || null;
  const lokasi = readText(values, "lokasi", "Lokasi", errors) || null;
  const deskripsi = readText(values, "deskripsi", "Deskripsi", errors) || null;
  const status = values?.status ?? "ACTIVE";
  if (!["ACTIVE", "INACTIVE"].includes(status)) errors.status = ["Pilih status aktif atau nonaktif."];
  const meeting = readMeetingTime(values, errors);
  if (Object.keys(errors).length) throw validationError(errors);
  return { nama_ekstrakurikuler, id_pembina, ...meeting, lokasi, deskripsi, status };
}

export function getExtracurricularView(record) {
  const rawCount = record.jumlah_anggota ?? record.anggota_count;
  const count = rawCount !== "" && rawCount != null && typeof rawCount !== "boolean" ? Number(rawCount) : NaN;
  const teacherName = text(record.nama_pembina ?? record.pembina?.nama ?? record.pembina?.nama_guru);
  return {
    id: text(record.id_ekstrakurikuler ?? record.id),
    title: text(record.nama_ekstrakurikuler ?? record.nama),
    teacherId: text(record.id_pembina ?? record.pembina?.id_guru ?? record.pembina?.id),
    teacherName,
    hari: text(record.hari).toLowerCase(),
    start: viewTime(record.jam_mulai), end: viewTime(record.jam_selesai),
    location: text(record.lokasi), description: text(record.deskripsi),
    status: text(record.status),
    members: Number.isSafeInteger(count) && count >= 0 ? count : null,
    photos: normalizePhotos(record.foto ?? record.foto_url, text(record.nama_ekstrakurikuler ?? record.nama)),
  };
}

const resourceApi = createActivityApi({
  endpoint: ENDPOINT,
  resource: "ekstrakurikuler", view: getExtracurricularView, buildPayload: buildExtracurricularPayload,
  prepareWrite: prepareExtracurricularWrite,
});

export const extracurricularApi = {
  ...resourceApi,
  async getPhotos({ signal } = {}) {
    const payload = await request(PHOTOS_ENDPOINT, { method: "get", params: { per_page: MAX_ACTIVITY_PHOTOS }, signal });
    const collection = normalizeHistoryCollection(payload, "foto");
    return normalizePhotos(collection.items).slice(0, MAX_ACTIVITY_PHOTOS);
  },
};

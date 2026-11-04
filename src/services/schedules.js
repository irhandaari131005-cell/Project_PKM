import { createActivityApi, readMeetingTime, readText, text, validationError, viewTime } from "./activityApi.js";

const env = import.meta.env ?? {};

export function buildSchedulePayload(values = {}) {
  const errors = {};
  const payload = {};
  for (const [field, label] of [["id_kelas", "Kelas"], ["id_guru", "Guru"], ["mata_pelajaran", "Mata pelajaran"]]) {
    payload[field] = readText(values, field, label, errors, true);
  }
  const meeting = readMeetingTime(values, errors);
  const ruangan = readText(values, "ruangan", "Ruangan", errors) || null;
  if (Object.keys(errors).length) throw validationError(errors);
  return { ...payload, ...meeting, ruangan };
}

export function getScheduleView(record) {
  return {
    id: text(record.id_jadwal ?? record.id),
    title: text(record.mata_pelajaran ?? record.nama_mapel),
    classId: text(record.id_kelas ?? record.kelas?.id_kelas ?? record.kelas?.id),
    className: text(record.nama_kelas ?? record.kelas?.nama_kelas ?? record.kelas?.nama),
    teacherId: text(record.id_guru ?? record.guru?.id_guru ?? record.guru?.id),
    teacherName: text(record.nama_guru ?? record.guru?.nama ?? record.guru?.nama_guru),
    hari: text(record.hari).toLowerCase(),
    start: viewTime(record.jam_mulai), end: viewTime(record.jam_selesai),
    location: text(record.ruangan),
  };
}

export const schedulesApi = createActivityApi({
  endpoint: env.VITE_SCHEDULES_ENDPOINT || "/api/jadwal",
  resource: "jadwal", view: getScheduleView, buildPayload: buildSchedulePayload, withClass: true,
});

import { Trophy } from "lucide-react";
import SchoolActivitiesPage from "../../components/SchoolActivitiesPage.jsx";
import { SCHOOL_DAYS } from "../../services/activityApi.js";
import { extracurricularApi, getExtracurricularView } from "../../services/extracurricular.js";
import ExtracurricularCarousel from "./ExtracurricularCarousel.jsx";

const config = {
  key: "extracurricular", title: "Ekstrakurikuler", subtitle: "Kegiatan, pembina, dan jadwal ekstrakurikuler siswa",
  searchLabel: "Cari nama ekstrakurikuler...", Icon: Trophy, api: extracurricularApi, view: getExtracurricularView,
  Carousel: ExtracurricularCarousel,
  initialValues: { nama_ekstrakurikuler: "", id_pembina: "", hari: "", jam_mulai: "", jam_selesai: "", lokasi: "", deskripsi: "", status: "ACTIVE", foto: [], hapus_foto: [] },
  toValues: (item) => ({ nama_ekstrakurikuler: item.title, id_pembina: item.teacherId, hari: item.hari, jam_mulai: item.start, jam_selesai: item.end, lokasi: item.location, deskripsi: item.description, status: item.status, foto: [], hapus_foto: [] }),
  fields: [
    { name: "nama_ekstrakurikuler", label: "Nama ekstrakurikuler", required: true },
    { name: "foto", label: "Foto kegiatan", type: "photos" },
    { name: "id_pembina", label: "Pembina", type: "select", source: "teachers", currentName: (item) => item.teacherName },
    { name: "hari", label: "Hari", type: "select", required: true, options: SCHOOL_DAYS.map((day) => ({ id: day.value, name: day.label })) },
    { name: "jam_mulai", label: "Jam mulai (WIB)", type: "time", required: true },
    { name: "jam_selesai", label: "Jam selesai (WIB)", type: "time", required: true },
    { name: "lokasi", label: "Lokasi" },
    { name: "deskripsi", label: "Deskripsi", type: "textarea" },
    { name: "status", label: "Status", type: "select", required: true, options: [{ id: "ACTIVE", name: "Aktif" }, { id: "INACTIVE", name: "Nonaktif" }] },
  ],
};

export default function Extracurricular() {
  return <SchoolActivitiesPage config={config} />;
}

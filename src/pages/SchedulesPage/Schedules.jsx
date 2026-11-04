import { CalendarDays } from "lucide-react";
import SchoolActivitiesPage from "../../components/SchoolActivitiesPage.jsx";
import { SCHOOL_DAYS } from "../../services/activityApi.js";
import { getScheduleView, schedulesApi } from "../../services/schedules.js";
import ScheduleCard from "./ScheduleCard.jsx";

const config = {
  key: "schedules", title: "Jadwal", subtitle: "Jadwal pelajaran, kelas, dan guru pengajar",
  searchLabel: "Cari mata pelajaran...", Icon: CalendarDays, api: schedulesApi, view: getScheduleView, withClass: true,
  Card: ScheduleCard,
  initialValues: { id_kelas: "", id_guru: "", mata_pelajaran: "", hari: "", jam_mulai: "", jam_selesai: "", ruangan: "" },
  toValues: (item) => ({ id_kelas: item.classId, id_guru: item.teacherId, mata_pelajaran: item.title, hari: item.hari, jam_mulai: item.start, jam_selesai: item.end, ruangan: item.location }),
  fields: [
    { name: "mata_pelajaran", label: "Mata pelajaran", required: true },
    { name: "id_kelas", label: "Kelas", type: "select", source: "classes", required: true, currentName: (item) => item.className },
    { name: "id_guru", label: "Guru", type: "select", source: "teachers", required: true, currentName: (item) => item.teacherName },
    { name: "hari", label: "Hari", type: "select", required: true, options: SCHOOL_DAYS.map((day) => ({ id: day.value, name: day.label })) },
    { name: "jam_mulai", label: "Jam mulai (WIB)", type: "time", required: true },
    { name: "jam_selesai", label: "Jam selesai (WIB)", type: "time", required: true },
    { name: "ruangan", label: "Ruangan" },
  ],
};

export default function Schedules() {
  return <SchoolActivitiesPage config={config} />;
}

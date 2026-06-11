import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "reception_queue_view");
    const hospitalId = session.payload.hospitalId;
    await connectDb();

    const filter: Record<string, unknown> = { hospitalId, appointmentDate: dateRangeFor(new Date()) };
    const status = req.nextUrl.searchParams.get("status")?.trim();
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter).sort({
      tokenNumber: 1,
      createdAt: 1,
    });
    const patientIds = [...new Set(appointments.map((appointment) => appointment.patientId).filter(Boolean))];
    const doctorIds = [
      ...new Set(
        appointments
          .map((appointment) => appointment.doctorUserId)
          .filter((doctorUserId): doctorUserId is string => Boolean(doctorUserId)),
      ),
    ];
    const departmentIds = [
      ...new Set(
        appointments
          .map((appointment) => appointment.departmentId)
          .filter((departmentId): departmentId is string => Boolean(departmentId)),
      ),
    ];

    const [patients, doctors, departments] = await Promise.all([
      Patient.find({ hospitalId, patientId: { $in: patientIds } }).select("patientId name phone email gender age status"),
      HospitalUser.find({ hospitalId, _id: { $in: doctorIds } }).select("name email phone role"),
      HospitalDepartment.find({ hospitalId, _id: { $in: departmentIds } }).select("name status"),
    ]);

    const patientById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const doctorById = new Map(doctors.map((doctor) => [doctor._id.toString(), doctor]));
    const departmentById = new Map(departments.map((department) => [department._id.toString(), department]));
    const queue = appointments.map((appointment) => ({
      ...appointment.toObject(),
      patient: patientById.get(appointment.patientId) ?? null,
      doctor: appointment.doctorUserId ? doctorById.get(appointment.doctorUserId) ?? null : null,
      department: appointment.departmentId ? departmentById.get(appointment.departmentId) ?? null : null,
    }));

    return successResponse(serializeDoc(queue), "Today queue fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

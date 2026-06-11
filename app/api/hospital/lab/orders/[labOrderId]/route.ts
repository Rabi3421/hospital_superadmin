import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { validateLabOrderTests } from "@/lib/hospital-lab";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import Consultation from "@/models/Consultation";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import HospitalUser from "@/models/HospitalUser";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import Patient from "@/models/Patient";
import Prescription from "@/models/Prescription";

const labOrderUpdateSchema = z.object({
  priority: z.enum(["Routine", "Urgent"]).optional(),
  notes: z.string().optional(),
  testIds: z.array(z.string().min(1)).min(1).optional(),
});

type RouteContext = { params: Promise<{ labOrderId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_orders_view");
    const { labOrderId } = await context.params;
    await connectDb();

    const order = await LabOrder.findOne({ hospitalId: session.payload.hospitalId, labOrderId });
    if (!order) return errorResponse("Lab order not found", 404);
    const hospitalId = session.payload.hospitalId;
    const [patient, doctor, doctorProfile, prescription, consultation, appointment, report, bill] = await Promise.all([
      Patient.findOne({ hospitalId, patientId: order.patientId }).select("patientId name phone email gender age status"),
      order.doctorUserId
        ? HospitalUser.findOne({ hospitalId, _id: order.doctorUserId, role: "DOCTOR" }).select("name email phone role status")
        : null,
      order.doctorUserId
        ? HospitalDoctorPublicProfile.findOne({ hospitalId, userId: order.doctorUserId }).select("specialization qualification")
        : null,
      order.prescriptionId ? Prescription.findOne({ hospitalId, prescriptionId: order.prescriptionId }) : null,
      order.consultationId ? Consultation.findOne({ hospitalId, consultationId: order.consultationId }).select("consultationId status") : null,
      order.appointmentId
        ? Appointment.findOne({ hospitalId, appointmentId: order.appointmentId }).select(
            "appointmentId tokenNumber appointmentDate appointmentTime status",
          )
        : null,
      LabReport.findOne({ hospitalId, labOrderId: order.labOrderId }).select("reportId status publishedAt"),
      Bill.findOne({ hospitalId, sourceType: "LabOrder", sourceId: order.labOrderId }).select(
        "billId status grandTotal paidAmount dueAmount",
      ),
    ]);
    const compactDoctor = doctor
      ? { ...doctor.toObject(), specialization: doctorProfile?.specialization ?? "" }
      : null;
    return successResponse(
      serializeDoc({
        ...order.toObject(),
        patient,
        doctor: compactDoctor,
        prescription,
        consultation,
        appointment,
        report,
        bill,
      }),
      "Lab order fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_orders_update");
    const hospitalId = session.payload.hospitalId;
    const { labOrderId } = await context.params;
    const body = labOrderUpdateSchema.parse(await req.json());
    await connectDb();

    const order = await LabOrder.findOne({ hospitalId, labOrderId });
    if (!order) return errorResponse("Lab order not found", 404);
    if (order.status !== "Ordered") return errorResponse("Only ordered lab orders can be edited", 409);
    if (body.priority !== undefined) order.priority = body.priority;
    if (body.notes !== undefined) order.notes = body.notes;
    if (body.testIds) order.tests = await validateLabOrderTests(body.testIds, hospitalId);
    await order.save();

    return successResponse(serializeDoc(order), "Lab order updated");
  } catch (error) {
    return handleApiError(error);
  }
}

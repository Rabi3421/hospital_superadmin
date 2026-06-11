import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { buildConsultationBillItems, createBillFromSource } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { assertDoctorOwnsRecord } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import Patient from "@/models/Patient";

const createConsultationBillSchema = z.object({
  unitPrice: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type RouteContext = { params: Promise<{ consultationId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "billing_create");
    const hospitalId = session.payload.hospitalId;
    const { consultationId } = await context.params;
    const body = createConsultationBillSchema.parse(await req.json().catch(() => ({})));
    await connectDb();

    const consultation = await Consultation.findOne({ hospitalId, consultationId });
    if (!consultation) return errorResponse("Consultation not found", 404);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, consultation.doctorUserId);
    const patient = await Patient.findOne({ hospitalId, patientId: consultation.patientId });
    if (!patient) return errorResponse("Patient not found", 404);
    const appointment = consultation.appointmentId
      ? await Appointment.findOne({ hospitalId, appointmentId: consultation.appointmentId })
      : null;
    if (consultation.appointmentId && !appointment) return errorResponse("Appointment not found", 404);
    const doctorProfile = await HospitalDoctorPublicProfile.findOne({
      hospitalId,
      userId: consultation.doctorUserId,
      status: "Active",
    }).select("consultationFee");
    const unitPrice = doctorProfile ? doctorProfile.consultationFee : body.unitPrice ?? 0;

    const { bill, created } = await createBillFromSource({
      hospitalId,
      patientId: consultation.patientId,
      appointmentId: consultation.appointmentId,
      consultationId: consultation.consultationId,
      doctorUserId: consultation.doctorUserId,
      sourceType: "Consultation",
      sourceId: consultation.consultationId,
      sourceRefId: consultation.consultationId,
      items: buildConsultationBillItems(unitPrice),
      notes: body.notes ?? "Created from consultation",
      createdBy: session.payload.userId,
      metadata: { appointmentId: consultation.appointmentId },
    });

    return successResponse(serializeDoc(bill), created ? "Consultation bill created" : "Bill already exists for this consultation", created ? 201 : 200);
  } catch (error) {
    return handleApiError(error);
  }
}

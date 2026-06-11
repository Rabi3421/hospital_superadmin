import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertDoctorOwnsRecord, pickDefined, prescriptionEditableFields } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Consultation from "@/models/Consultation";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";
import Prescription from "@/models/Prescription";

const medicineSchema = z.object({
  medicineName: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  instructions: z.string().optional(),
});

const testRecommendedSchema = z.object({
  testName: z.string().min(1),
  instructions: z.string().optional(),
  priority: z.enum(["Routine", "Urgent"]).optional(),
});

const prescriptionUpdateSchema = z.object({
  medicines: z.array(medicineSchema).optional(),
  testsRecommended: z.array(testRecommendedSchema).optional(),
  generalInstructions: z.string().optional(),
  followUpDate: z.coerce.date().optional(),
});

type RouteContext = { params: Promise<{ prescriptionId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "prescriptions_view");
    const { prescriptionId } = await context.params;
    await connectDb();

    const prescription = await Prescription.findOne({ hospitalId: session.payload.hospitalId, prescriptionId });
    if (!prescription) return errorResponse("Prescription not found", 404);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, prescription.doctorUserId);

    const hospitalId = session.payload.hospitalId;
    const [consultation, appointment, patient, doctor] = await Promise.all([
      Consultation.findOne({ hospitalId, consultationId: prescription.consultationId }),
      Appointment.findOne({ hospitalId, appointmentId: prescription.appointmentId }),
      Patient.findOne({ hospitalId, patientId: prescription.patientId }).select(
        "patientId name phone email gender age bloodGroup status",
      ),
      HospitalUser.findOne({ hospitalId, _id: prescription.doctorUserId, role: "DOCTOR" }).select(
        "name email phone role status",
      ),
    ]);

    return successResponse(
      serializeDoc({ ...prescription.toObject(), consultation, appointment, patient, doctor }),
      "Prescription fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "prescriptions_update");
    const { prescriptionId } = await context.params;
    const body = prescriptionUpdateSchema.parse(await req.json());
    await connectDb();

    const prescription = await Prescription.findOne({ hospitalId: session.payload.hospitalId, prescriptionId });
    if (!prescription) return errorResponse("Prescription not found", 404);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, prescription.doctorUserId);
    if (prescription.status !== "Draft") return errorResponse("Only draft prescriptions can be edited", 409);

    prescription.set(pickDefined(body, prescriptionEditableFields));
    await prescription.save();

    return successResponse(serializeDoc(prescription), "Prescription updated");
  } catch (error) {
    return handleApiError(error);
  }
}

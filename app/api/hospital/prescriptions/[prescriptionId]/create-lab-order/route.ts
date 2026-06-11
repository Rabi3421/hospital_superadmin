import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { assertDoctorOwnsRecord } from "@/lib/hospital-clinical";
import { requireHospitalAuth } from "@/lib/hospital-auth";
import { resolveHospitalPermissions } from "@/lib/hospital-permissions";
import { generateLabOrderId } from "@/lib/hospital-lab";
import LabOrder from "@/models/LabOrder";
import LabTest from "@/models/LabTest";
import Prescription from "@/models/Prescription";

const createSchema = z.object({
  priority: z.enum(["Routine", "Urgent"]).optional(),
  notes: z.string().optional(),
});

type RouteContext = { params: Promise<{ prescriptionId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalAuth(req);
    const permissions = resolveHospitalPermissions(session.user.role, session.user.permissions);
    if (!permissions.includes("lab_orders_create") && !permissions.includes("lab_recommendations_create") && !permissions.includes("hospital:*")) {
      return errorResponse("Forbidden: permission required", 403);
    }

    const hospitalId = session.payload.hospitalId;
    const { prescriptionId } = await context.params;
    const body = createSchema.parse(await req.json().catch(() => ({})));
    await connectDb();

    const prescription = await Prescription.findOne({ hospitalId, prescriptionId });
    if (!prescription) return errorResponse("Prescription not found", 404);
    assertDoctorOwnsRecord(session.user.role, session.payload.userId, prescription.doctorUserId);
    if (!prescription.testsRecommended.length) return errorResponse("Prescription has no recommended tests", 409);

    const existingOrder = await LabOrder.findOne({ hospitalId, prescriptionId: prescription.prescriptionId });
    if (existingOrder) {
      return successResponse(serializeDoc(existingOrder), "Lab order already exists for this prescription");
    }

    const names = prescription.testsRecommended.map((test) => test.testName);
    const existingTests = await LabTest.find({ hospitalId, name: { $in: names }, status: "Active" });
    const testByName = new Map(existingTests.map((test) => [test.name.toLowerCase(), test]));
    const tests = prescription.testsRecommended.map((recommended) => {
      const mapped = testByName.get(recommended.testName.toLowerCase());
      return {
        testId: mapped?.testId ?? "",
        testName: recommended.testName,
        price: mapped?.price ?? 0,
        status: "Ordered" as const,
        needsMapping: !mapped,
      };
    });

    const order = await LabOrder.create({
      hospitalId,
      labOrderId: await generateLabOrderId(hospitalId),
      patientId: prescription.patientId,
      appointmentId: prescription.appointmentId,
      consultationId: prescription.consultationId,
      prescriptionId: prescription.prescriptionId,
      doctorUserId: prescription.doctorUserId,
      tests,
      status: "Ordered",
      priority: body.priority ?? "Routine",
      notes: body.notes ?? "Created from prescription",
      createdBy: session.payload.userId,
    });
    return successResponse(serializeDoc(order), "Lab order created from prescription", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

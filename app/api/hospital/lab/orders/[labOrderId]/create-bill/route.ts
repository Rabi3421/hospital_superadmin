import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { buildLabOrderBillItems, createBillFromSource } from "@/lib/hospital-billing";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import LabOrder from "@/models/LabOrder";
import Patient from "@/models/Patient";

type RouteContext = { params: Promise<{ labOrderId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "billing_create");
    const hospitalId = session.payload.hospitalId;
    const { labOrderId } = await context.params;
    await connectDb();

    const labOrder = await LabOrder.findOne({ hospitalId, labOrderId });
    if (!labOrder) return errorResponse("Lab order not found", 404);
    const patient = await Patient.findOne({ hospitalId, patientId: labOrder.patientId });
    if (!patient) return errorResponse("Patient not found", 404);

    const { bill, created } = await createBillFromSource({
      hospitalId,
      patientId: labOrder.patientId,
      appointmentId: labOrder.appointmentId ?? "",
      consultationId: labOrder.consultationId ?? "",
      doctorUserId: labOrder.doctorUserId ?? "",
      sourceType: "LabOrder",
      sourceId: labOrder.labOrderId,
      sourceRefId: labOrder.labOrderId,
      items: buildLabOrderBillItems(labOrder),
      notes: "Created from lab order",
      createdBy: session.payload.userId,
      metadata: { prescriptionId: labOrder.prescriptionId },
    });

    return successResponse(serializeDoc(bill), created ? "Lab order bill created" : "Bill already exists for this lab order", created ? 201 : 200);
  } catch (error) {
    return handleApiError(error);
  }
}

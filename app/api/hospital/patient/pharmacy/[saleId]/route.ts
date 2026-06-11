import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requirePatientAuth } from "@/lib/hospital-patient";
import PharmacySale from "@/models/PharmacySale";

type RouteContext = { params: Promise<{ saleId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requirePatientAuth(req);
    const { saleId } = await context.params;
    await connectDb();
    const sale = await PharmacySale.findOne({
      hospitalId: session.payload.hospitalId,
      patientId: session.patient.patientId,
      saleId,
    });
    if (!sale) return errorResponse("Pharmacy sale not found", 404);
    return successResponse(serializeDoc(sale), "Patient pharmacy sale fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

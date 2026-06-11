import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import LabTest from "@/models/LabTest";

const labTestUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  category: z.string().optional(),
  sampleType: z.string().optional(),
  price: z.number().min(0).optional(),
  normalRange: z.string().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  preparationInstructions: z.string().optional(),
  reportTemplate: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

type RouteContext = { params: Promise<{ testId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_tests_view");
    const { testId } = await context.params;
    await connectDb();

    const test = await LabTest.findOne({ hospitalId: session.payload.hospitalId, testId });
    if (!test) return errorResponse("Lab test not found", 404);

    return successResponse(serializeDoc(test), "Lab test fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_tests_update");
    const { testId } = await context.params;
    const body = labTestUpdateSchema.parse(await req.json());
    await connectDb();

    const test = await LabTest.findOneAndUpdate(
      { hospitalId: session.payload.hospitalId, testId },
      { $set: body },
      { new: true },
    );
    if (!test) return errorResponse("Lab test not found", 404);

    return successResponse(serializeDoc(test), "Lab test updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "lab_tests_deactivate");
    const { testId } = await context.params;
    await connectDb();

    const test = await LabTest.findOneAndUpdate(
      { hospitalId: session.payload.hospitalId, testId },
      { $set: { status: "Inactive" } },
      { new: true },
    );
    if (!test) return errorResponse("Lab test not found", 404);

    return successResponse(serializeDoc(test), "Lab test deactivated");
  } catch (error) {
    return handleApiError(error);
  }
}

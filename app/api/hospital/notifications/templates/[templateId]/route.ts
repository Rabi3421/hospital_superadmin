import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalRole } from "@/lib/hospital-auth";
import NotificationTemplate from "@/models/NotificationTemplate";

const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  language: z.string().optional(),
  providerTemplateName: z.string().optional(),
  providerTemplateId: z.string().optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ templateId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalRole(req, ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR"]);
    const { templateId } = await context.params;
    await connectDb();

    const template = await NotificationTemplate.findOne({
      hospitalId: session.payload.hospitalId,
      templateId,
    });
    if (!template) return errorResponse("Notification template not found", 404);

    return successResponse(serializeDoc(template), "Notification template fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalRole(req, ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR"]);
    const { templateId } = await context.params;
    const body = templateUpdateSchema.parse(await req.json());
    await connectDb();

    const template = await NotificationTemplate.findOneAndUpdate(
      { hospitalId: session.payload.hospitalId, templateId },
      { $set: { ...body, updatedBy: session.payload.userId } },
      { new: true },
    );
    if (!template) return errorResponse("Notification template not found", 404);

    return successResponse(serializeDoc(template), "Notification template updated");
  } catch (error) {
    return handleApiError(error);
  }
}

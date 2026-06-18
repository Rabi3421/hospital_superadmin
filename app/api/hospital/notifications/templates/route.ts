import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPagination } from "@/lib/hospital-clinical";
import { requireHospitalRole } from "@/lib/hospital-auth";
import { generateTemplateId } from "@/lib/notifications/notification-service";
import NotificationTemplate from "@/models/NotificationTemplate";

const templateCreateSchema = z.object({
  eventType: z.string().min(1),
  channel: z.enum(["WHATSAPP", "SMS"]),
  name: z.string().min(1),
  body: z.string().min(1),
  variables: z.array(z.string()).default([]),
  language: z.string().optional(),
  providerTemplateName: z.string().optional(),
  providerTemplateId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalRole(req, ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR"]);
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    const eventType = req.nextUrl.searchParams.get("eventType")?.trim();
    if (eventType) filter.eventType = eventType;

    const channel = req.nextUrl.searchParams.get("channel")?.trim();
    if (channel) filter.channel = channel;

    const isActive = req.nextUrl.searchParams.get("isActive")?.trim();
    if (isActive === "true") filter.isActive = true;
    else if (isActive === "false") filter.isActive = false;

    await connectDb();
    const [templates, total] = await Promise.all([
      NotificationTemplate.find(filter).sort({ eventType: 1, channel: 1 }).skip(skip).limit(limit),
      NotificationTemplate.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(templates), "Notification templates fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalRole(req, ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR"]);
    const hospitalId = session.payload.hospitalId;
    const body = templateCreateSchema.parse(await req.json());
    await connectDb();

    const template = await NotificationTemplate.create({
      hospitalId,
      templateId: await generateTemplateId(hospitalId),
      eventType: body.eventType,
      channel: body.channel,
      name: body.name,
      body: body.body,
      variables: body.variables,
      language: body.language ?? "en",
      providerTemplateName: body.providerTemplateName ?? "",
      providerTemplateId: body.providerTemplateId ?? "",
      isActive: true,
      isSystemDefault: false,
      createdBy: session.payload.userId,
    } as Record<string, unknown>);

    return successResponse(serializeDoc(template), "Notification template created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

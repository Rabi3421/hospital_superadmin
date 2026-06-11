import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { escapeRegex, getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { generateLabTestId } from "@/lib/hospital-lab";
import LabTest from "@/models/LabTest";

const labTestSchema = z.object({
  name: z.string().min(1),
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

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "lab_tests_view");
    const hospitalId = session.payload.hospitalId;
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);
    const filter: Record<string, unknown> = { hospitalId };

    ["category", "status"].forEach((key) => {
      const value = req.nextUrl.searchParams.get(key)?.trim();
      if (value) filter[key] = value;
    });
    const search = (req.nextUrl.searchParams.get("search") ?? req.nextUrl.searchParams.get("q"))?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ testId: regex }, { name: regex }, { code: regex }, { category: regex }];
    }

    await connectDb();
    const [tests, total] = await Promise.all([
      LabTest.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      LabTest.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(tests), "Lab tests fetched", 200, {
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
    const session = await requireHospitalPermission(req, "lab_tests_create");
    const hospitalId = session.payload.hospitalId;
    const body = labTestSchema.parse(await req.json());
    await connectDb();

    const test = await LabTest.create({
      ...body,
      hospitalId,
      testId: await generateLabTestId(hospitalId),
      status: body.status ?? "Active",
      createdBy: session.payload.userId,
    });

    return successResponse(serializeDoc(test), "Lab test created", 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("E11000")) {
      return errorResponse("Lab test ID or code already exists", 409);
    }
    return handleApiError(error);
  }
}

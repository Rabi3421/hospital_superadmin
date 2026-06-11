import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import HospitalDepartment from "@/models/HospitalDepartment";

const departmentSchema = z.object({
  hospitalId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  icon: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  sortOrder: z.coerce.number().default(0),
});

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    await connectDb();
    const hospitalId = req.nextUrl.searchParams.get("hospitalId")?.trim();
    const filter = hospitalId ? { hospitalId } : {};
    const departments = await HospitalDepartment.find(filter).sort({ hospitalId: 1, sortOrder: 1, name: 1 });
    return successResponse(serializeDoc(departments));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    const body = departmentSchema.parse(await req.json());
    await connectDb();
    const hospital = await Hospital.findOne({ hospitalId: body.hospitalId });
    if (!hospital) return errorResponse("Hospital not found", 404);

    const department = await HospitalDepartment.create(body);
    return successResponse(serializeDoc(department), "Department created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

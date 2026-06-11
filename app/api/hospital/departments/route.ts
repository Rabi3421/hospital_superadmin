import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { departmentCreateSchema } from "@/lib/hospital-management";
import HospitalDepartment from "@/models/HospitalDepartment";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "departments_view");
    const status = req.nextUrl.searchParams.get("status");
    const filter: Record<string, unknown> = { hospitalId: session.payload.hospitalId };
    if (status) filter.status = status;
    await connectDb();
    const departments = await HospitalDepartment.find(filter).sort({ sortOrder: 1, name: 1 });
    return successResponse(serializeDoc(departments), "Departments fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "departments_create");
    const body = departmentCreateSchema.parse(await req.json());
    await connectDb();
    const department = await HospitalDepartment.create({ ...body, hospitalId: session.payload.hospitalId });
    return successResponse(serializeDoc(department), "Department created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

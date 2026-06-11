import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import HospitalDepartment from "@/models/HospitalDepartment";

const departmentUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  sortOrder: z.coerce.number().optional(),
});

type RouteContext = { params: Promise<{ departmentId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    const body = departmentUpdateSchema.parse(await req.json());
    await connectDb();
    const { departmentId } = await context.params;
    const department = await HospitalDepartment.findByIdAndUpdate(departmentId, body, { new: true, runValidators: true });
    if (!department) return errorResponse("Department not found", 404);
    return successResponse(serializeDoc(department), "Department updated");
  } catch (error) {
    return handleApiError(error);
  }
}

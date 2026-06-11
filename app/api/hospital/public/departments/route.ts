import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPublicWebsiteAccess } from "@/lib/public-website";
import HospitalDepartment from "@/models/HospitalDepartment";

export async function GET(req: NextRequest) {
  try {
    const { hospital, response } = await getPublicWebsiteAccess(req);
    if (response) return response;

    await connectDb();
    const departments = await HospitalDepartment.find({ hospitalId: hospital.hospitalId, status: "Active" }).sort({
      sortOrder: 1,
      name: 1,
    });
    return successResponse(serializeDoc(departments));
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { requireValidHospital } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const hospital = await requireValidHospital(req);

    if (hospital.websiteStatus === "Maintenance") {
      return errorResponse("Hospital website is currently under maintenance", 503, {
        websiteStatus: hospital.websiteStatus,
      });
    }

    if (hospital.websiteStatus === "Coming Soon") {
      return successResponse(
        {
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          slug: hospital.slug,
          logoUrl: hospital.logoUrl,
          type: hospital.type,
          status: hospital.status,
          websiteStatus: hospital.websiteStatus,
        },
        "Hospital website is coming soon",
      );
    }

    return successResponse(
      serializeDoc({
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        slug: hospital.slug,
        type: hospital.type,
        ownerPhone: hospital.ownerPhone,
        ownerEmail: hospital.ownerEmail,
        address: hospital.address,
        city: hospital.city,
        state: hospital.state,
        pincode: hospital.pincode,
        logoUrl: hospital.logoUrl,
        websiteStatus: hospital.websiteStatus,
        settings: hospital.settings,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

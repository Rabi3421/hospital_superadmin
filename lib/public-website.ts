import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requireValidHospital } from "@/lib/tenant";

export async function getPublicWebsiteAccess(req: NextRequest) {
  const hospital = await requireValidHospital(req);

  if (hospital.websiteStatus === "Maintenance") {
    return {
      hospital,
      response: errorResponse("Hospital website is currently under maintenance", 503, {
        websiteStatus: hospital.websiteStatus,
      }),
    };
  }

  if (hospital.websiteStatus === "Coming Soon") {
    return {
      hospital,
      response: successResponse(
        {
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          websiteStatus: hospital.websiteStatus,
        },
        "Hospital website is coming soon",
      ),
    };
  }

  return { hospital, response: null };
}

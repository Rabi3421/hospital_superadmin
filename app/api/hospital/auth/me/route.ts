import { NextRequest } from "next/server";
import { errorResponse, serializeDoc, successResponse } from "@/lib/api-response";
import { getDashboardRouteForRole } from "@/lib/hospital-dashboard";
import { getHospitalAuthSession, getOwnerBillingAuthSession } from "@/lib/hospital-auth";
import { buildPatientSetupState } from "@/lib/hospital-patient";
import { resolveHospitalPermissions } from "@/lib/hospital-permissions";

export async function GET(req: NextRequest) {
  const session = await getHospitalAuthSession(req) ?? await getOwnerBillingAuthSession(req);
  if (!session) return errorResponse("Unauthorized hospital session", 401);
  const permissions = resolveHospitalPermissions(session.user.role, session.user.permissions);
  const patientState = await buildPatientSetupState(session);

  return successResponse(
    serializeDoc({
      user: {
        _id: session.user._id,
        hospitalId: session.user.hospitalId,
        name: session.user.name,
        email: session.user.email,
        phone: session.user.phone,
        role: session.user.role,
        permissions,
        status: session.user.status,
        lastLoginAt: session.user.lastLoginAt,
      },
      hospital: {
        hospitalId: session.hospital.hospitalId,
        name: session.hospital.name,
        slug: session.hospital.slug,
        logoUrl: session.hospital.logoUrl,
        type: session.hospital.type,
        status: session.hospital.status,
      },
      role: session.user.role,
      permissions,
      dashboardRoute: session.hospital.suspendedForNonPaymentAt
        ? "/dashboard/owner/subscription-billing"
        : getDashboardRouteForRole(session.user.role),
      ...patientState,
    }),
    "Hospital session authenticated",
  );
}

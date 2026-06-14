import { NextRequest } from "next/server";
import { errorResponse, serializeDoc, successResponse } from "@/lib/api-response";
import { getAllowedNavigationForRole, getDashboardRouteForRole } from "@/lib/hospital-dashboard";
import { getHospitalAuthSession, getOwnerBillingAuthSession } from "@/lib/hospital-auth";
import { buildPatientSetupState } from "@/lib/hospital-patient";
import { resolveHospitalPermissions } from "@/lib/hospital-permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getHospitalAuthSession(req) ?? await getOwnerBillingAuthSession(req);
    if (!session) return errorResponse("Unauthorized hospital session", 401);
    const billingRecovery = Boolean(session.hospital.suspendedForNonPaymentAt);
    const patientState = await buildPatientSetupState(session);
    return successResponse(
      serializeDoc({
        hospital: {
          hospitalId: session.hospital.hospitalId,
          name: session.hospital.name,
          slug: session.hospital.slug,
          logoUrl: session.hospital.logoUrl,
          type: session.hospital.type,
          status: session.hospital.status,
          websiteStatus: session.hospital.websiteStatus,
          settings: session.hospital.settings,
        },
        user: {
          userId: session.user._id,
          name: session.user.name,
          email: session.user.email,
          phone: session.user.phone,
          status: session.user.status,
        },
        role: session.user.role,
        permissions: resolveHospitalPermissions(session.user.role, session.user.permissions),
        dashboardRoute: billingRecovery ? "/dashboard/owner/subscription-billing" : getDashboardRouteForRole(session.user.role),
        allowedNavigation: billingRecovery
          ? [{ label: "Subscription Billing", route: "/dashboard/owner/subscription-billing" }]
          : getAllowedNavigationForRole(session.user.role),
        ...patientState,
      }),
    );
  } catch {
    return errorResponse("Unauthorized hospital session", 401);
  }
}

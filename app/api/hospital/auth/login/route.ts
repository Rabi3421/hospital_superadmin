import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getDashboardRouteForRole } from "@/lib/hospital-dashboard";
import { setHospitalAuthCookie, signHospitalUserToken } from "@/lib/hospital-auth";
import { buildPatientSetupState } from "@/lib/hospital-patient";
import { resolveHospitalPermissions } from "@/lib/hospital-permissions";
import { getHospitalIdFromRequest, requireValidHospital } from "@/lib/tenant";
import { roleAllowedForHospital } from "@/lib/subscription-plans";
import Hospital from "@/models/Hospital";
import HospitalUser from "@/models/HospitalUser";

const loginSchema = z.object({
  email: z.string().email().optional(),
  identifier: z.string().min(1).optional(),
  password: z.string().min(1),
}).superRefine((body, ctx) => {
  if (!body.email && !body.identifier) {
    ctx.addIssue({ code: "custom", message: "Email or identifier is required", path: ["email"] });
  }
});

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());
    const hospitalId = getHospitalIdFromRequest(req);
    if (!hospitalId) return errorResponse("Hospital ID is required", 400);

    const headers = new Headers(req.headers);
    headers.set("x-hospital-id", hospitalId);
    const tenantRequest = new NextRequest(req.url, { method: "GET", headers });
    let hospital;
    try {
      hospital = await requireValidHospital(tenantRequest);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "Hospital is suspended") throw error;
      await connectDb();
      hospital = await Hospital.findOne({
        hospitalId,
        status: "Suspended",
        suspendedForNonPaymentAt: { $exists: true },
      });
      if (!hospital) throw error;
    }

    await connectDb();
    const identifier = (body.identifier ?? body.email ?? "").trim().toLowerCase();
    const user = await HospitalUser.findOne({
      hospitalId: hospital.hospitalId,
      $or: [{ email: identifier }, { phone: body.identifier?.trim() ?? "" }],
    });
    if (!user) return errorResponse("Invalid email or password", 401);
    if (user.status === "Blocked") return errorResponse("Hospital user account is blocked", 403);
    if ((user.role as string) === "HOSPITAL_OWNER") {
      return errorResponse("This role is no longer supported. Please contact the platform administrator.", 403);
    }
    if (Boolean(hospital.suspendedForNonPaymentAt)) {
      return errorResponse("Hospital service is suspended for non-payment. Please contact the platform administrator.", 403);
    }
    if (!roleAllowedForHospital(hospital, user.role)) {
      return errorResponse(`The ${hospital.subscriptionPlan} plan does not include the ${user.role.replaceAll("_", " ").toLowerCase()} dashboard`, 403);
    }

    const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordMatches) return errorResponse("Invalid email or password", 401);

    user.lastLoginAt = new Date();
    await user.save();
    const safeUser = await HospitalUser.findById(user._id).select("-passwordHash");
    const permissions = resolveHospitalPermissions(user.role, user.permissions);
    const patientState = await buildPatientSetupState({ payload: {
      userId: user._id.toString(),
      hospitalId: hospital.hospitalId,
      role: user.role,
    }, user, hospital });
    const token = signHospitalUserToken(user);
    const response = successResponse(
      serializeDoc({
        user: safeUser,
        hospital: {
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          slug: hospital.slug,
          logoUrl: hospital.logoUrl,
          type: hospital.type,
          status: hospital.status,
        },
        role: user.role,
        permissions,
        dashboardRoute: getDashboardRouteForRole(user.role),
        token,
        ...patientState,
      }),
      "Hospital user logged in",
    );
    setHospitalAuthCookie(response, token);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

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
    const hospital = await requireValidHospital(tenantRequest);
    if (!["Trial", "Active"].includes(hospital.status)) {
      return errorResponse("Hospital is not active for login", 403);
    }

    await connectDb();
    const identifier = (body.identifier ?? body.email ?? "").trim().toLowerCase();
    const user = await HospitalUser.findOne({
      hospitalId: hospital.hospitalId,
      $or: [{ email: identifier }, { phone: body.identifier?.trim() ?? "" }],
    });
    if (!user) return errorResponse("Invalid email or password", 401);
    if (user.status === "Blocked") return errorResponse("Hospital user account is blocked", 403);

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
      permissions,
    }, user, hospital });
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
        ...patientState,
      }),
      "Hospital user logged in",
    );
    setHospitalAuthCookie(response, signHospitalUserToken(user));
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

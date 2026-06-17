import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { type HospitalRole } from "@/lib/hospital-permissions";
import { roleAllowedForHospital } from "@/lib/subscription-plans";
import { reconcileSubscriptionBilling } from "@/lib/subscription-billing";
import Hospital, { type HospitalDocument } from "@/models/Hospital";
import HospitalUser, { type HospitalUserDocument } from "@/models/HospitalUser";

export const hospitalUserCookieName = "hsa_hospital_token";

export type HospitalUserJwtPayload = {
  userId: string;
  hospitalId: string;
  role: HospitalRole;
  iat?: number;
  exp?: number;
};

export type HospitalAuthSession = {
  payload: HospitalUserJwtPayload;
  user: HospitalUserDocument;
  hospital: HospitalDocument;
};

function getHospitalJwtSecret(): Secret {
  const secret = process.env.HOSPITAL_JWT_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("HOSPITAL_JWT_SECRET or JWT_SECRET is not configured");
  }
  return secret;
}

export function signHospitalUserToken(user: HospitalUserDocument) {
  const expiresIn = (process.env.HOSPITAL_JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];

  return jwt.sign(
    {
      userId: user._id.toString(),
      hospitalId: user.hospitalId,
      role: user.role,
    } satisfies HospitalUserJwtPayload,
    getHospitalJwtSecret(),
    { expiresIn },
  );
}

export function setHospitalAuthCookie(response: NextResponse, token: string) {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = isProduction && process.env.HOSPITAL_COOKIE_SAME_SITE === "none" ? "none" : "lax";

  response.cookies.set(hospitalUserCookieName, token, {
    httpOnly: true,
    sameSite,
    secure: isProduction,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearHospitalAuthCookie(response: NextResponse) {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = isProduction && process.env.HOSPITAL_COOKIE_SAME_SITE === "none" ? "none" : "lax";

  response.cookies.set(hospitalUserCookieName, "", {
    httpOnly: true,
    sameSite,
    secure: isProduction,
    path: "/",
    maxAge: 0,
  });
}

export function decodeHospitalToken(token: string) {
  return jwt.verify(token, getHospitalJwtSecret()) as HospitalUserJwtPayload;
}

export async function getHospitalAuthSession(req: NextRequest): Promise<HospitalAuthSession | null> {
  const token = req.cookies.get(hospitalUserCookieName)?.value;
  if (!token) return null;

  try {
    const payload = decodeHospitalToken(token);
    await connectDb();
    await reconcileSubscriptionBilling(payload.hospitalId);
    const [user, hospital] = await Promise.all([
      HospitalUser.findOne({
        _id: payload.userId,
        hospitalId: payload.hospitalId,
        status: "Active",
      }),
      Hospital.findOne({
        hospitalId: payload.hospitalId,
        status: { $in: ["Trial", "Active"] },
      }),
    ]);

    if (!user || !hospital) return null;
    // Explicitly block legacy HOSPITAL_OWNER tokens — role is no longer supported
    if ((user.role as string) === "HOSPITAL_OWNER") return null;
    if (!roleAllowedForHospital(hospital, user.role)) return null;
    return { payload, user, hospital };
  } catch {
    return null;
  }
}


export async function requireHospitalAuth(req: NextRequest) {
  const session = await getHospitalAuthSession(req);
  if (!session) {
    throw new Error("Unauthorized hospital session");
  }
  return session;
}

export async function requireHospitalPermission(req: NextRequest, permission: string) {
  const session = await requireHospitalAuth(req);
  const permissions = resolveHospitalPermissions(session.user.role, session.user.permissions);
  const hasPermission =
    permissions.includes(permission) ||
    permissions.includes("hospital:*") ||
    permissions.some((value) => value.endsWith(":*") && permission.startsWith(value.slice(0, -1)));

  if (!hasPermission) {
    throw new Error("Forbidden: permission required");
  }
  return session;
}

export async function requireHospitalRole(req: NextRequest, roles: HospitalRole[]) {
  const session = await requireHospitalAuth(req);
  if (!roles.includes(session.user.role)) {
    throw new Error("Forbidden: role not allowed");
  }
  return session;
}

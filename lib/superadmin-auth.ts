import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import SuperAdmin, { type SuperAdminDocument } from "@/models/SuperAdmin";

export const superAdminCookieName = "hsa_access_token";

type SuperAdminJwtPayload = {
  sub: string;
  email: string;
  role: "SUPERADMIN";
};

function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

export function signSuperAdminToken(admin: SuperAdminDocument) {
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];

  return jwt.sign(
    {
      sub: admin._id.toString(),
      email: admin.email,
      role: admin.role,
    } satisfies SuperAdminJwtPayload,
    getJwtSecret(),
    { expiresIn },
  );
}

export function setSuperAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(superAdminCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSuperAdminCookie(response: NextResponse) {
  response.cookies.set(superAdminCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSuperAdminFromRequest(req: NextRequest) {
  const token = req.cookies.get(superAdminCookieName)?.value;
  return getSuperAdminFromToken(token);
}

export async function getSuperAdminFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(superAdminCookieName)?.value;
  return getSuperAdminFromToken(token);
}

async function getSuperAdminFromToken(token?: string) {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as SuperAdminJwtPayload;
    await connectDb();
    const admin = await SuperAdmin.findById(payload.sub).select("-passwordHash");
    if (!admin || admin.status !== "Active") {
      return null;
    }
    return admin;
  } catch {
    return null;
  }
}

export async function requireSuperAdmin(req: NextRequest) {
  const admin = await getSuperAdminFromRequest(req);
  if (!admin) {
    throw new Error("Unauthorized");
  }
  return admin;
}

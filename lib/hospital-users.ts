import { z } from "zod";
import { type HospitalAuthSession } from "@/lib/hospital-auth";
import { getPermissionsForRole, hospitalRoles, type HospitalRole } from "@/lib/hospital-permissions";
import { type HospitalUserDocument } from "@/models/HospitalUser";

export const hospitalUserStatusValues = ["Active", "Blocked"] as const;

export const hospitalUserCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().min(6).optional().default(""),
  patientId: z.string().optional().or(z.literal("")),
  password: z.string().min(8),
  role: z.enum(hospitalRoles),
  status: z.enum(hospitalUserStatusValues).optional().default("Active"),
  permissions: z.array(z.string()).optional(),
});

export const hospitalUserUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().transform((value) => value.toLowerCase()).optional(),
  phone: z.string().min(6).optional().or(z.literal("")),
  patientId: z.string().optional().or(z.literal("")),
  role: z.enum(hospitalRoles).optional(),
  status: z.enum(hospitalUserStatusValues).optional(),
  permissions: z.array(z.string()).optional(),
});

export const hospitalUserResetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export function defaultPermissionsForHospitalUser(role: HospitalRole) {
  return getPermissionsForRole(role);
}

export function canManageHospitalUserRole(actorRole: HospitalRole, targetRole: HospitalRole) {
  if (actorRole === "MANAGING_DIRECTOR") return true;
  return actorRole === "HOSPITAL_ADMIN" && targetRole !== "MANAGING_DIRECTOR";
}

export function ensureCanManageHospitalUser(
  session: HospitalAuthSession,
  target: Pick<HospitalUserDocument, "_id" | "role">,
  options: { allowSelf?: boolean; selfMessage?: string } = {},
) {
  if (!options.allowSelf && target._id.toString() === session.user._id.toString()) {
    throw new Error(options.selfMessage ?? "Forbidden: cannot manage your own account from this endpoint");
  }

  if (!canManageHospitalUserRole(session.user.role, target.role)) {
    throw new Error("Forbidden: cannot manage this hospital user role");
  }
}

export function ensureCanAssignHospitalUserRole(actorRole: HospitalRole, role: HospitalRole) {
  if (!canManageHospitalUserRole(actorRole, role)) {
    throw new Error("Forbidden: cannot assign this hospital user role");
  }
}

export function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

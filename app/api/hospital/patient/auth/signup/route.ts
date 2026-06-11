import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { generatePatientId } from "@/lib/hospital-clinical";
import { getDashboardRouteForRole } from "@/lib/hospital-dashboard";
import { defaultPermissionsForHospitalUser } from "@/lib/hospital-users";
import { getHospitalIdFromRequest } from "@/lib/tenant";
import Hospital from "@/models/Hospital";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

const phoneSchema = z.string().trim().min(6).regex(/^[0-9+\-\s()]+$/, "Phone number format is invalid");

const signupSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: phoneSchema.optional(),
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  identifier: z.string().trim().min(1).optional(),
  password: z.string().min(8),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  age: z.coerce.number().int().min(0).max(130).optional(),
  dateOfBirth: z.coerce.date().optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
}).superRefine((body, ctx) => {
  if (!body.email && !body.phone && !body.identifier) {
    ctx.addIssue({ code: "custom", message: "Email or phone and password are required.", path: ["identifier"] });
  }
  if (body.identifier && !body.identifier.includes("@")) {
    const result = phoneSchema.safeParse(body.identifier);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: "Identifier must be a valid email or phone number.", path: ["identifier"] });
    }
  }
  if (body.identifier?.includes("@") && !z.string().email().safeParse(body.identifier).success) {
    ctx.addIssue({ code: "custom", message: "Identifier must be a valid email or phone number.", path: ["identifier"] });
  }
});

function fallbackPatientName(email?: string, phone?: string) {
  if (email) {
    const prefix = email.split("@")[0].replace(/[._-]+/g, " ").trim();
    return prefix
      .split(/\s+/)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ")
      .slice(0, 100) || "Patient";
  }
  return `Patient ${phone?.replace(/\D/g, "").slice(-4) || "Account"}`;
}

export async function POST(req: NextRequest) {
  let createdPatientId = "";

  try {
    const hospitalId = getHospitalIdFromRequest(req);
    if (!hospitalId) return errorResponse("Hospital ID is required", 400);

    const parsed = signupSchema.safeParse(await req.json());
    if (!parsed.success) {
      const passwordIssue = parsed.error.issues.find((issue) => issue.path[0] === "password");
      const identifierIssue = parsed.error.issues.find((issue) => issue.path[0] === "identifier");
      const message = identifierIssue?.message
        ?? (passwordIssue ? "Password must be at least 8 characters." : parsed.error.issues[0]?.message)
        ?? "Validation failed";
      return errorResponse(message, 422, parsed.error.flatten());
    }
    const body = parsed.data;
    const identifierIsEmail = body.identifier?.includes("@");
    const email = body.email ?? (identifierIsEmail ? body.identifier?.toLowerCase() : undefined);
    const phone = body.phone ?? (!identifierIsEmail ? body.identifier : undefined);
    const name = body.name ?? fallbackPatientName(email, phone);
    await connectDb();

    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) return errorResponse("Hospital not found", 404);
    if (!["Trial", "Active"].includes(hospital.status)) {
      return errorResponse(`Hospital is ${hospital.status.toLowerCase()}`, 403);
    }
    if (hospital.websiteStatus === "Maintenance") {
      return errorResponse("Hospital website is currently under maintenance", 503, { websiteStatus: hospital.websiteStatus });
    }
    if (hospital.websiteStatus === "Coming Soon") {
      return errorResponse("Patient signup is not available until the hospital website is live", 403, {
        websiteStatus: hospital.websiteStatus,
      });
    }

    const identityFilters = [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ];
    const existingUser = await HospitalUser.findOne({ hospitalId, $or: identityFilters });
    if (existingUser) {
      return errorResponse("Account already exists. Please login.", 409);
    }

    const existingPatient = await Patient.findOne({
      hospitalId,
      status: "Active",
      $or: identityFilters,
    });
    if (existingPatient) {
      return errorResponse("A patient record already exists. Please contact hospital reception to link your account.", 409);
    }

    const patient = await Patient.create({
      hospitalId,
      patientId: await generatePatientId(hospitalId),
      name,
      phone,
      email,
      gender: body.gender,
      age: body.age,
      dateOfBirth: body.dateOfBirth,
      bloodGroup: body.bloodGroup ?? "",
      address: body.address ?? "",
      city: body.city ?? "",
      state: body.state ?? "",
      pincode: body.pincode ?? "",
      emergencyContactName: body.emergencyContactName ?? "",
      emergencyContactPhone: body.emergencyContactPhone ?? "",
      status: "Active",
      profileCompleted: false,
      createdBy: "patient-self-signup",
    });
    createdPatientId = patient.patientId;

    const user = await HospitalUser.create({
      hospitalId,
      patientId: patient.patientId,
      name,
      email,
      phone,
      passwordHash: await bcrypt.hash(body.password, 12),
      role: "PATIENT",
      permissions: defaultPermissionsForHospitalUser("PATIENT"),
      status: "Active",
    });
    const safeUser = await HospitalUser.findById(user._id).select("-passwordHash");

    return successResponse(
      serializeDoc({
        patient: {
          patientId: patient.patientId,
          name: patient.name,
          phone: patient.phone ?? null,
          email: patient.email ?? null,
          profileCompleted: patient.profileCompleted,
        },
        user: {
          id: safeUser?._id,
          name: safeUser?.name,
          email: safeUser?.email ?? null,
          phone: safeUser?.phone ?? null,
          role: safeUser?.role,
          dashboardRoute: getDashboardRouteForRole("PATIENT"),
        },
        loginRequired: true,
      }),
      "Patient account created successfully",
      201,
    );
  } catch (error) {
    if (createdPatientId) {
      const hospitalId = getHospitalIdFromRequest(req);
      await Patient.deleteOne({ hospitalId, patientId: createdPatientId }).catch(() => null);
    }
    if (error instanceof Error && "code" in error && error.code === 11000) {
      return errorResponse("Account already exists. Please login.", 409);
    }
    return handleApiError(error);
  }
}

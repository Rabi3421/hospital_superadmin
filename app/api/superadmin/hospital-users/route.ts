import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPermissionsForRole, hospitalRoles } from "@/lib/hospital-permissions";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

const createHospitalUserSchema = z.object({
  hospitalId: z.string().min(1),
  patientId: z.string().optional().or(z.literal("")),
  name: z.string().min(2),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().min(6).optional().or(z.literal("")),
  password: z.string().min(8),
  role: z.enum(hospitalRoles),
  status: z.enum(["Active", "Blocked"]).optional().default("Active"),
  permissions: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    await connectDb();
    const hospitalId = req.nextUrl.searchParams.get("hospitalId")?.trim();
    const role = req.nextUrl.searchParams.get("role")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const search = req.nextUrl.searchParams.get("q")?.trim();
    const filter: Record<string, unknown> = {};
    if (hospitalId) filter.hospitalId = hospitalId;
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }

    const users = await HospitalUser.find(filter).select("-passwordHash").sort({ createdAt: -1 }).limit(100);
    return successResponse(serializeDoc(users));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(await req.json());
    await connectDb();
    const result = await HospitalUser.deleteMany({ _id: { $in: ids } });
    return successResponse({ deleted: result.deletedCount }, `${result.deletedCount} user(s) deleted`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    const body = createHospitalUserSchema.parse(await req.json());
    await connectDb();
    const hospital = await Hospital.findOne({ hospitalId: body.hospitalId });
    if (!hospital) {
      return errorResponse("Hospital not found", 404);
    }
    if (hospital.status === "Cancelled") {
      return errorResponse("Cannot create users for a cancelled hospital", 409);
    }

    const existing = await HospitalUser.findOne({ hospitalId: body.hospitalId, email: body.email });
    if (existing) {
      return errorResponse("A hospital user with this email already exists for this hospital", 409);
    }
    if (body.role === "PATIENT" && !body.patientId?.trim()) {
      return errorResponse("Patient ID is required for patient users", 400);
    }
    if (body.patientId?.trim()) {
      const patient = await Patient.findOne({ hospitalId: body.hospitalId, patientId: body.patientId.trim() });
      if (!patient) {
        return errorResponse("Patient not found for this hospital", 404);
      }
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await HospitalUser.create({
      hospitalId: body.hospitalId,
      name: body.name,
      email: body.email,
      phone: body.phone ?? "",
      patientId: body.role === "PATIENT" ? body.patientId?.trim() : "",
      passwordHash,
      role: body.role,
      permissions: body.permissions?.length ? body.permissions : getPermissionsForRole(body.role),
      status: body.status,
    });

    const safeUser = await HospitalUser.findById(user._id).select("-passwordHash");
    return successResponse(serializeDoc(safeUser), "Hospital user created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

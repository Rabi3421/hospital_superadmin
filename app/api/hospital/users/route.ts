import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { ensureHospitalCapacity } from "@/lib/hospital-capacity";
import { roleAllowedForHospital } from "@/lib/subscription-plans";
import {
  defaultPermissionsForHospitalUser,
  ensureCanAssignHospitalUserRole,
  hospitalUserCreateSchema,
} from "@/lib/hospital-users";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "hospital_users_view");
    await connectDb();

    const search = req.nextUrl.searchParams.get("q")?.trim();
    const role = req.nextUrl.searchParams.get("role")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const page = Math.max(Number(req.nextUrl.searchParams.get("page") ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 20), 1), 100);
    const filter: Record<string, unknown> = { hospitalId: session.payload.hospitalId };

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }

    const [users, total] = await Promise.all([
      HospitalUser.find(filter)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      HospitalUser.countDocuments(filter),
    ]);

    return successResponse(serializeDoc(users), "Hospital users fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "hospital_users_create");
    const body = hospitalUserCreateSchema.parse(await req.json());
    ensureCanAssignHospitalUserRole(session.user.role, body.role);
    await connectDb();
    if (!roleAllowedForHospital(session.hospital, body.role)) {
      return errorResponse(`The ${session.hospital.subscriptionPlan} plan does not include the ${body.role.replaceAll("_", " ").toLowerCase()} dashboard`, 403);
    }
    if (body.role !== "PATIENT") {
      await ensureHospitalCapacity(session.hospital, body.role === "DOCTOR" ? "doctor" : "staff");
    }

    const existing = await HospitalUser.findOne({ hospitalId: session.payload.hospitalId, email: body.email });
    if (existing) {
      return errorResponse("A hospital user with this email already exists", 409);
    }
    if (body.role === "PATIENT" && !body.patientId?.trim()) {
      return errorResponse("Patient ID is required for patient users", 400);
    }
    if (body.patientId?.trim()) {
      const patient = await Patient.findOne({
        hospitalId: session.payload.hospitalId,
        patientId: body.patientId.trim(),
      });
      if (!patient) return errorResponse("Patient not found for this hospital", 404);
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await HospitalUser.create({
      hospitalId: session.payload.hospitalId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      patientId: body.role === "PATIENT" ? body.patientId?.trim() : "",
      passwordHash,
      role: body.role,
      permissions: defaultPermissionsForHospitalUser(body.role),
      status: body.status,
    });

    const safeUser = await HospitalUser.findById(user._id).select("-passwordHash");
    return successResponse(serializeDoc(safeUser), "Hospital user created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

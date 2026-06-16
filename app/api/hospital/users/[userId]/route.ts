import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import {
  defaultPermissionsForHospitalUser,
  ensureCanAssignHospitalUserRole,
  ensureCanManageHospitalUser,
  hospitalUserUpdateSchema,
  pickDefined,
} from "@/lib/hospital-users";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "hospital_users_view");
    const { userId } = await context.params;
    await connectDb();

    const user = await HospitalUser.findOne({
      _id: userId,
      hospitalId: session.payload.hospitalId,
    }).select("-passwordHash");
    if (!user) return errorResponse("Hospital user not found", 404);

    return successResponse(serializeDoc(user), "Hospital user fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "hospital_users_update");
    const { userId } = await context.params;
    const body = hospitalUserUpdateSchema.parse(await req.json());
    await connectDb();

    const target = await HospitalUser.findOne({
      _id: userId,
      hospitalId: session.payload.hospitalId,
    });
    if (!target) return errorResponse("Hospital user not found", 404);

    const isSelf = target._id.toString() === session.user._id.toString();
    ensureCanManageHospitalUser(session, target, { allowSelf: true });

    if (body.role) {
      ensureCanAssignHospitalUserRole(session.user.role, body.role);
    }

    if (isSelf && body.role && body.role !== target.role) {
      return errorResponse("Cannot change your own role from this endpoint", 403);
    }
    if (isSelf && body.status === "Blocked") {
      return errorResponse("Cannot block your own account from this endpoint", 403);
    }
    const nextRole = body.role ?? target.role;
    const nextPatientId = body.patientId !== undefined ? body.patientId.trim() : target.patientId?.trim();
    if (nextRole === "PATIENT" && !nextPatientId) {
      return errorResponse("Patient ID is required for patient users", 400);
    }
    if (nextRole === "PATIENT" && nextPatientId) {
      const patient = await Patient.findOne({
        hospitalId: session.payload.hospitalId,
        patientId: nextPatientId,
      });
      if (!patient) return errorResponse("Patient not found for this hospital", 404);
    }
    if (body.email && body.email !== target.email) {
      const existing = await HospitalUser.findOne({
        hospitalId: session.payload.hospitalId,
        email: body.email,
        _id: { $ne: target._id },
      });
      if (existing) {
        return errorResponse("A hospital user with this email already exists", 409);
      }
    }

    const update = pickDefined({
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      patientId: nextRole === "PATIENT" ? nextPatientId : "",
      status: body.status,
    });

    if (body.permissions !== undefined) {
      update.permissions = body.permissions;
    } else if (body.role && body.role !== target.role) {
      update.permissions = defaultPermissionsForHospitalUser(body.role);
    }

    const updatedUser = await HospitalUser.findOneAndUpdate(
      { _id: userId, hospitalId: session.payload.hospitalId },
      { $set: update },
      { new: true, runValidators: true },
    ).select("-passwordHash");

    return successResponse(serializeDoc(updatedUser), "Hospital user updated");
  } catch (error) {
    return handleApiError(error);
  }
}

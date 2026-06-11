import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { patientProfileSelect, requirePatientAuth } from "@/lib/hospital-patient";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().min(6).regex(/^[0-9+\-\s()]+$/, "Phone number format is invalid").optional().or(z.literal("")),
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional().or(z.literal("")),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  dateOfBirth: z.coerce.date().optional(),
  age: z.coerce.number().int().min(0).max(130).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bloodGroup: z.string().optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    return successResponse(serializeDoc(session.patient), "Patient profile fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const body = profileUpdateSchema.parse(await req.json());
    await connectDb();
    const hospitalId = session.payload.hospitalId;
    const patientId = session.patient.patientId;
    const nextEmail = body.email === undefined ? session.patient.email : body.email || undefined;
    const nextPhone = body.phone === undefined ? session.patient.phone : body.phone || undefined;
    if (!nextEmail && !nextPhone) {
      return errorResponse("Patient profile requires an email or phone number", 422);
    }

    const identityFilters = [
      ...(nextEmail ? [{ email: nextEmail }] : []),
      ...(nextPhone ? [{ phone: nextPhone }] : []),
    ];
    const [otherUser, otherPatient] = await Promise.all([
      HospitalUser.findOne({ hospitalId, _id: { $ne: session.user._id }, $or: identityFilters }).select("_id"),
      Patient.findOne({ hospitalId, patientId: { $ne: patientId }, $or: identityFilters }).select("_id"),
    ]);
    if (otherUser || otherPatient) {
      return errorResponse("Email or phone is already in use in this hospital", 409);
    }

    const nextName = body.name ?? session.patient.name;
    const nextGender = body.gender ?? session.patient.gender;
    const nextAge = body.age ?? session.patient.age;
    const nextDateOfBirth = body.dateOfBirth ?? session.patient.dateOfBirth;
    const profileCompleted = Boolean(nextName && (nextEmail || nextPhone) && nextGender && (nextAge !== undefined || nextDateOfBirth));
    const patientSet: Record<string, unknown> = {
      ...body,
      profileCompleted,
    };
    delete patientSet.email;
    delete patientSet.phone;
    if (nextEmail) patientSet.email = nextEmail;
    if (nextPhone) patientSet.phone = nextPhone;
    if (profileCompleted) patientSet.profileCompletedAt = session.patient.profileCompletedAt ?? new Date();
    const patientUnset = {
      ...(!nextEmail ? { email: 1 } : {}),
      ...(!nextPhone ? { phone: 1 } : {}),
      ...(!profileCompleted ? { profileCompletedAt: 1 } : {}),
    };

    const userSet: Record<string, unknown> = { name: nextName };
    if (nextEmail) userSet.email = nextEmail;
    if (nextPhone) userSet.phone = nextPhone;
    await HospitalUser.updateOne(
      { _id: session.user._id, hospitalId, patientId, role: "PATIENT" },
      {
        $set: userSet,
        $unset: {
          ...(!nextEmail ? { email: 1 } : {}),
          ...(!nextPhone ? { phone: 1 } : {}),
        },
      },
      { runValidators: true },
    );
    const updatedPatient = await Patient.findOneAndUpdate(
      { hospitalId, patientId },
      { $set: patientSet, $unset: patientUnset },
      { new: true, runValidators: true },
    ).select(patientProfileSelect);

    return successResponse(serializeDoc(updatedPatient), "Patient profile updated");
  } catch (error) {
    return handleApiError(error);
  }
}

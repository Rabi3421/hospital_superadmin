import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { escapeRegex, getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "clinical_records_view");
    const hospitalId = session.payload.hospitalId;
    const role = session.user.role;

    if (role === "PATIENT") {
      throw new Error("Forbidden: patients cannot access this endpoint");
    }

    await connectDb();
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);

    const filter: Record<string, unknown> = { hospitalId };

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? req.nextUrl.searchParams.get("search")?.trim();
    if (q) {
      const escaped = escapeRegex(q);
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { patientId: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }

    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .select("patientId name phone email gender age bloodGroup status createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Patient.countDocuments(filter),
    ]);

    // For each patient, count appointments for summary
    const patientIds = patients.map((p) => p.patientId);
    const appointmentCounts = await Appointment.aggregate([
      { $match: { hospitalId, patientId: { $in: patientIds } } },
      { $group: { _id: "$patientId", count: { $sum: 1 } } },
    ]);
    const countByPatientId = new Map(appointmentCounts.map((a) => [a._id, a.count]));

    const result = patients.map((p) => ({
      ...p.toObject(),
      appointmentCount: countByPatientId.get(p.patientId) ?? 0,
    }));

    return successResponse(serializeDoc(result), "Patients fetched", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

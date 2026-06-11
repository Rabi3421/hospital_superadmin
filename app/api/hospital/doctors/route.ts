import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPagination } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { doctorProfileCreateSchema, validateDoctorProfileReferences } from "@/lib/hospital-management";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";

async function generateDoctorId(hospitalId: string) {
  const year = new Date().getFullYear();
  const prefix = `DCT-${year}-`;
  const latest = await HospitalDoctorPublicProfile.findOne({
    hospitalId,
    doctorId: { $regex: `^${prefix}` },
  })
    .sort({ doctorId: -1 })
    .select("doctorId");
  const nextNumber = latest?.doctorId ? Number(latest.doctorId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

async function enrichWithDepartmentName(
  docs: Awaited<ReturnType<typeof HospitalDoctorPublicProfile.find>>,
) {
  const deptIds = [...new Set(docs.map((d) => d.departmentId).filter(Boolean))] as string[];
  const departments = deptIds.length
    ? await HospitalDepartment.find({ _id: { $in: deptIds } }).select("name")
    : [];
  const deptMap = new Map(departments.map((d) => [d._id.toString(), d.name]));
  return docs.map((d) => ({
    ...d.toObject(),
    departmentName: d.departmentId ? (deptMap.get(d.departmentId) ?? "") : "",
  }));
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "doctor_profiles_view");
    const hospitalId = session.payload.hospitalId;
    const search = req.nextUrl.searchParams.get("q")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const departmentId = req.nextUrl.searchParams.get("departmentId")?.trim();
    const { page, limit, skip } = getPagination(req.nextUrl.searchParams);

    const filter: Record<string, unknown> = { hospitalId };
    if (status) filter.status = status;
    if (departmentId) filter.departmentId = departmentId;
    if (search) filter.$or = [{ name: new RegExp(search, "i") }, { specialization: new RegExp(search, "i") }];

    await connectDb();

    const [rawDoctors, total] = await Promise.all([
      HospitalDoctorPublicProfile.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      HospitalDoctorPublicProfile.countDocuments(filter),
    ]);

    const doctors = await enrichWithDepartmentName(rawDoctors);

    return successResponse(
      { doctors: serializeDoc(doctors), total, page, limit },
      "Doctor profiles fetched",
      200,
      { totalPages: Math.ceil(total / limit) },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "doctor_profiles_create");
    const hospitalId = session.payload.hospitalId;
    const body = doctorProfileCreateSchema.parse(await req.json());

    await connectDb();
    await validateDoctorProfileReferences(hospitalId, body);

    const doctorId = await generateDoctorId(hospitalId);
    const rawDoctor = await HospitalDoctorPublicProfile.create({ ...body, hospitalId, doctorId });

    const enriched = await enrichWithDepartmentName([rawDoctor]);
    return successResponse({ doctor: serializeDoc(enriched[0]) }, "Doctor profile created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

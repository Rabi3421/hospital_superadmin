import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Consultation from "@/models/Consultation";
import Hospital from "@/models/Hospital";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";
import HospitalContactEnquiry from "@/models/HospitalContactEnquiry";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import HospitalGallery from "@/models/HospitalGallery";
import HospitalNotice from "@/models/HospitalNotice";
import HospitalUser from "@/models/HospitalUser";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import LabTest from "@/models/LabTest";
import Medicine from "@/models/Medicine";
import MedicineBatch from "@/models/MedicineBatch";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import PlatformPayment from "@/models/PlatformPayment";
import Prescription from "@/models/Prescription";
import StockMovement from "@/models/StockMovement";
import Subscription from "@/models/Subscription";

const updateHospitalSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["Clinic", "Hospital", "Diagnostic Center", "Nursing Home"]).optional(),
  ownerName: z.string().min(2).optional(),
  ownerPhone: z.string().min(6).optional(),
  ownerEmail: z.string().email().transform((value) => value.toLowerCase()).optional(),
  address: z.string().min(3).optional(),
  city: z.string().min(2).optional(),
  state: z.string().min(2).optional(),
  pincode: z.string().min(3).optional(),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  registrationNumber: z.string().optional(),
  gstNumber: z.string().optional(),
  websiteStatus: z.enum(["Live", "Maintenance", "Coming Soon"]).optional(),
  status: z.enum(["Trial", "Active", "Suspended", "Cancelled", "Pending"]).optional(),
  subscriptionPlan: z.string().min(1).optional(),
  billingStartDate: z.coerce.date().optional(),
  nextBillingDate: z.coerce.date().optional(),
  monthlyPrice: z.coerce.number().min(0).optional(),
  maxDoctors: z.coerce.number().int().min(0).optional(),
  maxStaff: z.coerce.number().int().min(0).optional(),
  maxPatients: z.coerce.number().int().min(0).optional(),
  settings: z
    .object({
      currency: z.string().min(2).optional(),
      timezone: z.string().min(2).optional(),
      appointmentTokenPrefix: z.string().min(1).optional(),
      receiptPrefix: z.string().min(1).optional(),
    })
    .optional(),
});

type RouteContext = {
  params: Promise<{ hospitalId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    await connectDb();
    const { hospitalId } = await context.params;
    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) {
      return errorResponse("Hospital not found", 404);
    }

    return successResponse(serializeDoc(hospital));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    const body = updateHospitalSchema.parse(await req.json());
    await connectDb();
    const { hospitalId } = await context.params;
    if (body.ownerEmail) {
      const [existingHospital, existingUser] = await Promise.all([
        Hospital.findOne({ hospitalId: { $ne: hospitalId }, ownerEmail: body.ownerEmail }),
        HospitalUser.findOne({ hospitalId: { $ne: hospitalId }, email: body.ownerEmail }),
      ]);
      if (existingHospital || existingUser) {
        return errorResponse("This owner email is already used by another hospital or hospital user", 409);
      }
    }

    const hospital = await Hospital.findOneAndUpdate({ hospitalId }, body, {
      new: true,
      runValidators: true,
    });

    if (!hospital) {
      return errorResponse("Hospital not found", 404);
    }

    return successResponse(serializeDoc(hospital), "Hospital updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    await connectDb();
    const { hospitalId } = await context.params;
    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) {
      return errorResponse("Hospital not found", 404);
    }

    const deleteResults = await Promise.all([
      Appointment.deleteMany({ hospitalId }),
      Bill.deleteMany({ hospitalId }),
      BillPayment.deleteMany({ hospitalId }),
      Consultation.deleteMany({ hospitalId }),
      HospitalAppointmentRequest.deleteMany({ hospitalId }),
      HospitalContactEnquiry.deleteMany({ hospitalId }),
      HospitalDepartment.deleteMany({ hospitalId }),
      HospitalDoctorPublicProfile.deleteMany({ hospitalId }),
      HospitalGallery.deleteMany({ hospitalId }),
      HospitalNotice.deleteMany({ hospitalId }),
      HospitalUser.deleteMany({ hospitalId }),
      LabOrder.deleteMany({ hospitalId }),
      LabReport.deleteMany({ hospitalId }),
      LabTest.deleteMany({ hospitalId }),
      Medicine.deleteMany({ hospitalId }),
      MedicineBatch.deleteMany({ hospitalId }),
      Patient.deleteMany({ hospitalId }),
      PharmacySale.deleteMany({ hospitalId }),
      PlatformPayment.deleteMany({ hospitalId }),
      Prescription.deleteMany({ hospitalId }),
      StockMovement.deleteMany({ hospitalId }),
      Subscription.deleteMany({ hospitalId }),
    ]);
    await Hospital.deleteOne({ hospitalId });

    const deletedRelatedCount = deleteResults.reduce((total, result) => total + result.deletedCount, 0);
    return successResponse(
      { hospitalId, deletedRelatedCount },
      "Hospital deleted",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import { graceEndsFor, nextMonthlyDueDate } from "@/lib/subscription-billing";
import { getSubscriptionPlan, subscriptionPlanNames } from "@/lib/subscription-plans";
import Appointment from "@/models/Appointment";
import AppointmentSlot from "@/models/AppointmentSlot";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import BillingReminder from "@/models/BillingReminder";
import Consultation from "@/models/Consultation";
import DoctorAvailability from "@/models/DoctorAvailability";
import Hospital from "@/models/Hospital";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";
import HospitalContactEnquiry from "@/models/HospitalContactEnquiry";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import HospitalGallery from "@/models/HospitalGallery";
import HospitalNotice from "@/models/HospitalNotice";
import HospitalUser from "@/models/HospitalUser";
import HospitalWebsitePage from "@/models/HospitalWebsitePage";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import LabTest from "@/models/LabTest";
import Medicine from "@/models/Medicine";
import MedicineBatch from "@/models/MedicineBatch";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import PlatformPayment from "@/models/PlatformPayment";
import Prescription from "@/models/Prescription";
import ReferralPartner from "@/models/ReferralPartner";
import StockMovement from "@/models/StockMovement";
import Subscription from "@/models/Subscription";

const updateHospitalSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["Clinic", "Hospital", "Diagnostic Center", "Nursing Home"]).optional(),
  ownerName: z.string().min(2).optional(),
  ownerPhone: z.string().min(6).optional(),
  ownerEmail: z.string().email().transform((value) => value.toLowerCase()).optional(),
  referredBy: z.string().min(2).optional(),
  referralPartnerId: z.string().trim().optional(),
  address: z.string().min(3).optional(),
  city: z.string().min(2).optional(),
  state: z.string().min(2).optional(),
  pincode: z.string().min(3).optional(),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  registrationNumber: z.string().optional(),
  gstNumber: z.string().optional(),
  websiteStatus: z.enum(["Live", "Maintenance", "Coming Soon"]).optional(),
  status: z.enum(["Trial", "Active", "Suspended", "Cancelled", "Pending"]).optional(),
  subscriptionPlan: z.enum(subscriptionPlanNames).optional(),
  billingStartDate: z.coerce.date().optional(),
  nextBillingDate: z.coerce.date().optional(),
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
    const selectedPlan = body.subscriptionPlan ? getSubscriptionPlan(body.subscriptionPlan) : null;
    await connectDb();
    const { hospitalId } = await context.params;
    const currentHospital = await Hospital.findOne({ hospitalId });
    if (!currentHospital) {
      return errorResponse("Hospital not found", 404);
    }
    if (body.status === "Active" && (selectedPlan?.name ?? currentHospital.subscriptionPlan) === "Free Starter") {
      return errorResponse("Free Starter is a trial-only plan. Select a paid plan before activation.", 422);
    }
    const referralPartner = body.referralPartnerId
      ? await ReferralPartner.findOne({ referralPartnerId: body.referralPartnerId, status: "Active" })
      : null;
    if (body.referralPartnerId && !referralPartner) {
      return errorResponse("Selected referral partner is unavailable. Choose an active profile.", 422);
    }
    const activeNextBillingDate = body.status === "Active"
      ? body.nextBillingDate ?? nextMonthlyDueDate()
      : undefined;
    const update = {
      ...body,
      ...(body.referralPartnerId !== undefined ? {
        referralPartnerId: referralPartner?.referralPartnerId ?? "",
        referredBy: referralPartner?.name ?? body.referredBy ?? "Direct / Self",
      } : {}),
      ...(activeNextBillingDate ? { billingStartDate: body.billingStartDate ?? new Date(), nextBillingDate: activeNextBillingDate } : {}),
      ...(selectedPlan ? {
        monthlyPrice: selectedPlan.priceOptions[0],
        maxDoctors: selectedPlan.maxDoctors,
        maxStaff: selectedPlan.maxStaff,
        maxPatients: selectedPlan.maxPatients,
      } : {}),
    };
    if (body.ownerEmail) {
      const [existingHospital, existingUser] = await Promise.all([
        Hospital.findOne({ hospitalId: { $ne: hospitalId }, ownerEmail: body.ownerEmail }),
        HospitalUser.findOne({ hospitalId: { $ne: hospitalId }, email: body.ownerEmail }),
      ]);
      if (existingHospital || existingUser) {
        return errorResponse("This owner email is already used by another hospital or hospital user", 409);
      }
    }

    const hospital = await Hospital.findOneAndUpdate({ hospitalId }, update, {
      new: true,
      runValidators: true,
    });

    if (!hospital) {
      return errorResponse("Hospital not found", 404);
    }
    if (selectedPlan) {
      await Subscription.findOneAndUpdate(
        { hospitalId },
        {
          planName: selectedPlan.name,
          monthlyPrice: selectedPlan.priceOptions[0],
          features: [...selectedPlan.features],
        },
      );
    }
    if (body.status && body.status !== "Pending") {
      await Subscription.findOneAndUpdate(
        { hospitalId },
        {
          $set: {
            status: body.status === "Suspended" ? "Suspended" : body.status,
            ...(activeNextBillingDate ? {
              startDate: body.billingStartDate ?? new Date(),
              nextBillingDate: activeNextBillingDate,
              graceEndsAt: graceEndsFor(activeNextBillingDate),
            } : {}),
          },
          ...(["Active", "Suspended"].includes(body.status) ? { $unset: { suspendedForNonPaymentAt: 1 } } : {}),
        },
      );
      if (["Active", "Suspended"].includes(body.status)) {
        await Hospital.updateOne({ hospitalId }, { $unset: { suspendedForNonPaymentAt: 1 } });
      }
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

    // Revoke website and dashboard access before removing related records.
    // If cleanup fails midway, the tenant remains inaccessible instead of partially active.
    await Hospital.updateOne(
      { hospitalId },
      { $set: { status: "Cancelled", websiteStatus: "Maintenance" } },
    );

    const deleteResults = await Promise.all([
      Appointment.deleteMany({ hospitalId }),
      AppointmentSlot.deleteMany({ hospitalId }),
      Bill.deleteMany({ hospitalId }),
      BillPayment.deleteMany({ hospitalId }),
      BillingReminder.deleteMany({ hospitalId }),
      Consultation.deleteMany({ hospitalId }),
      DoctorAvailability.deleteMany({ hospitalId }),
      HospitalAppointmentRequest.deleteMany({ hospitalId }),
      HospitalContactEnquiry.deleteMany({ hospitalId }),
      HospitalDepartment.deleteMany({ hospitalId }),
      HospitalDoctorPublicProfile.deleteMany({ hospitalId }),
      HospitalGallery.deleteMany({ hospitalId }),
      HospitalNotice.deleteMany({ hospitalId }),
      HospitalUser.deleteMany({ hospitalId }),
      HospitalWebsitePage.deleteMany({ hospitalId }),
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

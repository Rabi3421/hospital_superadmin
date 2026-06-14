import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { defaultPermissionsForHospitalUser } from "@/lib/hospital-users";
import { appendSlugSuffix, createSlug } from "@/lib/slug";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import { seedHospitalWebsiteStarter } from "@/lib/hospital-website-starter";
import { getPlanPrice, getSubscriptionPlan, subscriptionPlanNames } from "@/lib/subscription-plans";
import Hospital, { type HospitalDocument } from "@/models/Hospital";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalGallery from "@/models/HospitalGallery";
import HospitalNotice from "@/models/HospitalNotice";
import HospitalUser, { type HospitalUserDocument } from "@/models/HospitalUser";
import HospitalWebsitePage from "@/models/HospitalWebsitePage";
import ReferralPartner from "@/models/ReferralPartner";
import Subscription, { type SubscriptionDocument } from "@/models/Subscription";

const initialUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().min(6).optional().or(z.literal("")),
  password: z.string().min(8),
  role: z.enum(["HOSPITAL_OWNER", "HOSPITAL_ADMIN"]).optional().default("HOSPITAL_OWNER"),
});

const hospitalSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["Clinic", "Hospital", "Diagnostic Center", "Nursing Home"]),
  ownerName: z.string().min(2),
  ownerPhone: z.string().min(6),
  ownerEmail: z.string().email().transform((value) => value.toLowerCase()),
  referredBy: z.string().min(2),
  referralPartnerId: z.string().trim().optional(),
  address: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().min(3),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  registrationNumber: z.string().optional(),
  gstNumber: z.string().optional(),
  subscriptionPlan: z.enum(subscriptionPlanNames).default("Free Starter"),
  monthlyPrice: z.coerce.number().min(0),
  pricingNote: z.string().max(500).optional(),
  skipInitialUser: z.boolean().optional().default(false),
  initialUser: initialUserSchema.optional(),
  settings: z
    .object({
      currency: z.string().min(2).default("INR"),
      timezone: z.string().min(2).default("Asia/Kolkata"),
      appointmentTokenPrefix: z.string().min(1).default("APT"),
      receiptPrefix: z.string().min(1).default("RCP"),
    })
    .partial()
    .optional(),
}).superRefine((body, ctx) => {
  if (!body.skipInitialUser && !body.initialUser) {
    ctx.addIssue({
      code: "custom",
      message: "Initial owner/admin user is required unless skipInitialUser is true",
      path: ["initialUser"],
    });
  }
});

async function createHospitalId() {
  const year = new Date().getFullYear();
  const prefix = `HSP-${year}-`;
  const count = await Hospital.countDocuments({ hospitalId: new RegExp(`^${prefix}`) });
  let sequence = count + 1;

  while (true) {
    const hospitalId = `${prefix}${String(sequence).padStart(4, "0")}`;
    const exists = await Hospital.exists({ hospitalId });
    if (!exists) {
      return hospitalId;
    }
    sequence += 1;
  }
}

async function createUniqueSlug(name: string) {
  const base = createSlug(name) || "hospital";
  let slug = base;
  let suffix = 1;

  while (await Hospital.exists({ slug })) {
    suffix += 1;
    slug = appendSlugSuffix(base, suffix);
  }

  return slug;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) {
      return errorResponse("Unauthorized", 401);
    }

    await connectDb();
    const search = req.nextUrl.searchParams.get("q")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { hospitalId: new RegExp(search, "i") },
        { ownerEmail: new RegExp(search, "i") },
        { referredBy: new RegExp(search, "i") },
      ];
    }
    if (status) {
      filter.status = status;
    }

    const hospitals = await Hospital.find(filter).sort({ createdAt: -1 }).limit(100);
    return successResponse(serializeDoc(hospitals));
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

    const body = hospitalSchema.parse(await req.json());
    const selectedPlan = getSubscriptionPlan(body.subscriptionPlan);
    if (!selectedPlan) {
      return errorResponse("Invalid subscription plan", 422);
    }
    const selectedPrice = getPlanPrice(body.subscriptionPlan, body.monthlyPrice);
    if (selectedPrice === undefined) {
      return errorResponse("Invalid price for the selected subscription plan", 422);
    }
    const priceType = selectedPrice === 0 ? "Free" : selectedPrice === selectedPlan.priceOptions[0] ? "Standard" : "Negotiated";
    if (priceType === "Negotiated" && !body.pricingNote?.trim()) {
      return errorResponse("A negotiation note is required for the approved discounted price", 422);
    }
    await connectDb();
    const referralPartner = body.referralPartnerId
      ? await ReferralPartner.findOne({ referralPartnerId: body.referralPartnerId, status: "Active" })
      : null;
    if (body.referralPartnerId && !referralPartner) {
      return errorResponse("Selected referral partner is unavailable. Refresh and choose an active profile.", 422);
    }

    const ownerEmailInUse = await Hospital.exists({ ownerEmail: body.ownerEmail });
    if (ownerEmailInUse) {
      return errorResponse("A hospital with this owner email already exists", 409);
    }

    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    const hospitalId = await createHospitalId();
    const hospitalPayload = {
      name: body.name,
      type: body.type,
      ownerName: body.ownerName,
      ownerPhone: body.ownerPhone,
      ownerEmail: body.ownerEmail,
      referredBy: referralPartner?.name ?? body.referredBy,
      referralPartnerId: referralPartner?.referralPartnerId ?? "",
      address: body.address,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      logoUrl: body.logoUrl,
      registrationNumber: body.registrationNumber,
      gstNumber: body.gstNumber,
      subscriptionPlan: body.subscriptionPlan,
      monthlyPrice: selectedPrice,
      maxDoctors: selectedPlan.maxDoctors,
      maxStaff: selectedPlan.maxStaff,
      maxPatients: selectedPlan.maxPatients,
      hospitalId,
      slug: await createUniqueSlug(body.name),
      status: "Trial" as const,
      websiteStatus: "Coming Soon" as const,
      trialStartDate: now,
      trialEndDate,
      settings: {
        currency: body.settings?.currency ?? "INR",
        timezone: body.settings?.timezone ?? "Asia/Kolkata",
        appointmentTokenPrefix: body.settings?.appointmentTokenPrefix ?? "APT",
        receiptPrefix: body.settings?.receiptPrefix ?? "RCP",
      },
    };

    let hospital: HospitalDocument | null = null;
    let subscription: SubscriptionDocument | null = null;
    let initialUser: HospitalUserDocument | null = null;

    try {
      hospital = await Hospital.create(hospitalPayload);

      subscription = await Subscription.create({
        hospitalId: hospital.hospitalId,
        planName: body.subscriptionPlan,
        monthlyPrice: selectedPrice,
        priceType,
        pricingNote: body.pricingNote?.trim() ?? "",
        billingCycle: "Monthly",
        status: "Trial",
        startDate: now,
        endDate: trialEndDate,
        nextBillingDate: trialEndDate,
        features: [...selectedPlan.features],
      });

      if (body.initialUser) {
        const existing = await HospitalUser.findOne({
          hospitalId: hospital.hospitalId,
          email: body.initialUser.email,
        });
        if (existing) {
          await Promise.all([
            Hospital.deleteOne({ hospitalId: hospital.hospitalId }),
            HospitalDepartment.deleteMany({ hospitalId: hospital.hospitalId }),
            HospitalGallery.deleteMany({ hospitalId: hospital.hospitalId }),
            HospitalNotice.deleteMany({ hospitalId: hospital.hospitalId }),
            Subscription.deleteMany({ hospitalId: hospital.hospitalId }),
            HospitalUser.deleteMany({ hospitalId: hospital.hospitalId }),
            HospitalWebsitePage.deleteMany({ hospitalId: hospital.hospitalId }),
          ]);
          return errorResponse("A user with this email already exists for this hospital", 409);
        }

        const passwordHash = await bcrypt.hash(body.initialUser.password, 12);
        const createdUser = await HospitalUser.create({
          hospitalId: hospital.hospitalId,
          name: body.initialUser.name,
          email: body.initialUser.email,
          phone: body.initialUser.phone ?? "",
          passwordHash,
          role: body.initialUser.role,
          permissions: defaultPermissionsForHospitalUser(body.initialUser.role),
          status: "Active",
        });
        initialUser = await HospitalUser.findById(createdUser._id).select("-passwordHash");
      }
      await seedHospitalWebsiteStarter(hospital);
    } catch (error) {
      if (hospital?.hospitalId) {
        await Promise.all([
          Hospital.deleteOne({ hospitalId: hospital.hospitalId }),
          HospitalDepartment.deleteMany({ hospitalId: hospital.hospitalId }),
          HospitalGallery.deleteMany({ hospitalId: hospital.hospitalId }),
          HospitalNotice.deleteMany({ hospitalId: hospital.hospitalId }),
          Subscription.deleteMany({ hospitalId: hospital.hospitalId }),
          HospitalUser.deleteMany({ hospitalId: hospital.hospitalId }),
          HospitalWebsitePage.deleteMany({ hospitalId: hospital.hospitalId }),
        ]);
      }
      throw error;
    }

    return successResponse(
      serializeDoc({
        hospital,
        subscription,
        initialUser,
        onboarding: {
          hospitalId: hospital?.hospitalId,
          initialUserCreated: Boolean(initialUser),
          initialUserRole: initialUser?.role,
          dashboardRoute: initialUser?.role === "HOSPITAL_ADMIN" ? "/dashboard/admin" : "/dashboard/owner",
          nextSteps: [
            "Login with the initial hospital credential",
            "Complete the hospital profile and settings",
            "Create departments and staff users",
            "Publish doctor profiles and website content",
          ],
        },
      }),
      "Hospital created",
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

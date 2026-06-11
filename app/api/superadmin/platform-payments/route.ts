import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getSuperAdminFromRequest } from "@/lib/superadmin-auth";
import Hospital from "@/models/Hospital";
import PlatformPayment from "@/models/PlatformPayment";

const paymentSchema = z.object({
  hospitalId: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentDate: z.coerce.date(),
  paymentMode: z.enum(["Cash", "UPI", "Bank Transfer", "Card", "Online"]),
  transactionId: z.string().optional(),
  billingMonth: z.string().min(1),
  status: z.enum(["Paid", "Pending", "Failed", "Refunded"]).default("Pending"),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    await connectDb();
    const hospitalId = req.nextUrl.searchParams.get("hospitalId")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const billingMonth = req.nextUrl.searchParams.get("billingMonth")?.trim();
    const filter: Record<string, unknown> = {};
    if (hospitalId) filter.hospitalId = hospitalId;
    if (status) filter.status = status;
    if (billingMonth) filter.billingMonth = billingMonth;

    const payments = await PlatformPayment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).limit(200);
    return successResponse(serializeDoc(payments));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getSuperAdminFromRequest(req);
    if (!admin) return errorResponse("Unauthorized", 401);

    const body = paymentSchema.parse(await req.json());
    await connectDb();
    const hospital = await Hospital.findOne({ hospitalId: body.hospitalId });
    if (!hospital) return errorResponse("Hospital not found", 404);

    const payment = await PlatformPayment.create(body);
    return successResponse(serializeDoc(payment), "Platform payment created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

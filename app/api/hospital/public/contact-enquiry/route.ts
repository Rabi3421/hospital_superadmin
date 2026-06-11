import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { getPublicWebsiteAccess } from "@/lib/public-website";
import HospitalContactEnquiry from "@/models/HospitalContactEnquiry";

const contactSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().min(3),
});

export async function POST(req: NextRequest) {
  try {
    const { hospital, response } = await getPublicWebsiteAccess(req);
    if (response) return response;

    const body = contactSchema.parse(await req.json());
    await connectDb();
    const enquiry = await HospitalContactEnquiry.create({ ...body, hospitalId: hospital.hospitalId, status: "New" });
    return successResponse(serializeDoc(enquiry), "Contact enquiry submitted", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

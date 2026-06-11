import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { contactEnquiryUpdateSchema } from "@/lib/hospital-content";
import HospitalContactEnquiry from "@/models/HospitalContactEnquiry";

type RouteContext = { params: Promise<{ enquiryId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "contact_enquiries_view");
    const { enquiryId } = await context.params;
    await connectDb();
    const enquiry = await HospitalContactEnquiry.findOne({ _id: enquiryId, hospitalId: session.payload.hospitalId });
    if (!enquiry) return errorResponse("Contact enquiry not found", 404);
    return successResponse(serializeDoc(enquiry), "Contact enquiry fetched");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "contact_enquiries_update");
    const { enquiryId } = await context.params;
    const body = contactEnquiryUpdateSchema.parse(await req.json());
    await connectDb();
    const enquiry = await HospitalContactEnquiry.findOneAndUpdate(
      { _id: enquiryId, hospitalId: session.payload.hospitalId },
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!enquiry) return errorResponse("Contact enquiry not found", 404);
    return successResponse(serializeDoc(enquiry), "Contact enquiry updated");
  } catch (error) {
    return handleApiError(error);
  }
}

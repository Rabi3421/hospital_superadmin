import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import Consultation from "@/models/Consultation";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";

type RouteContext = { params: Promise<{ saleId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "pharmacy_sales_view");
    const { saleId } = await context.params;
    await connectDb();
    const hospitalId = session.payload.hospitalId;
    const sale = await PharmacySale.findOne({ hospitalId, saleId });
    if (!sale) return errorResponse("Pharmacy sale not found", 404);
    const [patient, prescription, consultation, appointment, bill] = await Promise.all([
      Patient.findOne({ hospitalId, patientId: sale.patientId }).select("patientId name phone email gender age status"),
      sale.prescriptionId ? Prescription.findOne({ hospitalId, prescriptionId: sale.prescriptionId }) : null,
      sale.consultationId ? Consultation.findOne({ hospitalId, consultationId: sale.consultationId }) : null,
      sale.appointmentId ? Appointment.findOne({ hospitalId, appointmentId: sale.appointmentId }) : null,
      Bill.findOne({ hospitalId, sourceType: "PharmacySale", sourceId: sale.saleId }),
    ]);
    const doctorUser = prescription?.doctorUserId
      ? await HospitalUser.findOne({ hospitalId, _id: prescription.doctorUserId }).select("name email phone role status")
      : null;
    const doctorProfile = prescription?.doctorUserId
      ? await HospitalDoctorPublicProfile.findOne({ hospitalId, userId: prescription.doctorUserId }).select(
          "userId specialization qualification",
        )
      : null;
    const doctor = doctorUser
      ? { ...doctorUser.toObject(), userId: String(doctorUser._id), profile: doctorProfile }
      : null;
    return successResponse(
      serializeDoc({
        ...sale.toObject(),
        totalAmount: sale.grandTotal,
        patient,
        prescription,
        consultation,
        appointment,
        doctor,
        bill,
        stockAllocations: sale.items,
      }),
      "Pharmacy sale fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

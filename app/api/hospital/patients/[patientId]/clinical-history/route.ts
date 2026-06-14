import { NextRequest } from "next/server";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { resolveHospitalPermissions } from "@/lib/hospital-permissions";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Consultation from "@/models/Consultation";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";

type RouteContext = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireHospitalPermission(req, "patient_clinical_history_view");
    if (session.user.role === "PATIENT") return errorResponse("Patient self-access is not supported yet", 403);

    const hospitalId = session.payload.hospitalId;
    const { patientId } = await context.params;
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 10), 1), 50);
    await connectDb();

    const patient = await Patient.findOne({ hospitalId, patientId }).select(
      "patientId name phone email gender age dateOfBirth bloodGroup allergies currentMedications medicalHistory emergencyContactName emergencyContactPhone status",
    );
    if (!patient) return errorResponse("Patient not found", 404);
    if (session.user.role === "DOCTOR") {
      const assignedRecords = await Promise.all([
        Appointment.exists({ hospitalId, patientId, doctorUserId: session.payload.userId }),
        Consultation.exists({ hospitalId, patientId, doctorUserId: session.payload.userId }),
      ]);
      if (!assignedRecords.some(Boolean)) return errorResponse("Patient is not assigned to this doctor", 403);
    }

    const permissions = resolveHospitalPermissions(session.user.role, session.user.permissions);
    const canViewBilling = permissions.includes("billing_view") || permissions.includes("hospital:*");
    const canViewLabOrders = permissions.includes("lab_orders_view") || permissions.includes("hospital:*");
    const canViewLabReports = permissions.includes("lab_reports_view") || permissions.includes("hospital:*");
    const canViewPharmacySales = permissions.includes("pharmacy_sales_view") || permissions.includes("hospital:*");

    const [recentAppointments, consultations, prescriptions, bills, labOrders, labReports, pharmacySales] = await Promise.all([
      Appointment.find({ hospitalId, patientId }).sort({ appointmentDate: -1, createdAt: -1 }).limit(limit),
      Consultation.find({ hospitalId, patientId }).sort({ createdAt: -1 }).limit(limit),
      Prescription.find({ hospitalId, patientId }).sort({ createdAt: -1 }).limit(limit),
      canViewBilling ? Bill.find({ hospitalId, patientId }).sort({ createdAt: -1 }).limit(limit) : Promise.resolve([]),
      canViewLabOrders ? LabOrder.find({ hospitalId, patientId }).sort({ createdAt: -1 }).limit(limit) : Promise.resolve([]),
      canViewLabReports ? LabReport.find({ hospitalId, patientId }).sort({ createdAt: -1 }).limit(limit) : Promise.resolve([]),
      canViewPharmacySales ? PharmacySale.find({ hospitalId, patientId }).sort({ createdAt: -1 }).limit(limit) : Promise.resolve([]),
    ]);
    const payments = canViewBilling
      ? await BillPayment.find({ hospitalId, patientId }).sort({ paymentDate: -1, createdAt: -1 }).limit(limit)
      : [];
    const doctorIds = [
      ...new Set(
        [
          ...recentAppointments.map((appointment) => appointment.doctorUserId),
          ...consultations.map((consultation) => consultation.doctorUserId),
          ...prescriptions.map((prescription) => prescription.doctorUserId),
        ].filter((doctorUserId): doctorUserId is string => Boolean(doctorUserId)),
      ),
    ];
    const departmentIds = [
      ...new Set(
        [
          ...recentAppointments.map((appointment) => appointment.departmentId),
          ...consultations.map((consultation) => consultation.departmentId),
        ].filter((departmentId): departmentId is string => Boolean(departmentId)),
      ),
    ];
    const [doctors, departments] = await Promise.all([
      HospitalUser.find({ hospitalId, _id: { $in: doctorIds }, role: "DOCTOR" }).select("name email phone role status"),
      HospitalDepartment.find({ hospitalId, _id: { $in: departmentIds } }).select("name description icon status"),
    ]);
    const doctorById = new Map(doctors.map((doctor) => [doctor._id.toString(), doctor]));
    const departmentById = new Map(departments.map((department) => [department._id.toString(), department]));
    const reportByOrderId = new Map(labReports.map((report) => [report.labOrderId, report]));
    const appointments = recentAppointments.map((appointment) => ({
      ...appointment.toObject(),
      doctor: appointment.doctorUserId ? doctorById.get(appointment.doctorUserId) ?? null : null,
      department: appointment.departmentId ? departmentById.get(appointment.departmentId) ?? null : null,
    }));
    const enrichedConsultations = consultations.map((consultation) => ({
      ...consultation.toObject(),
      doctor: doctorById.get(consultation.doctorUserId) ?? null,
      department: consultation.departmentId ? departmentById.get(consultation.departmentId) ?? null : null,
    }));
    const enrichedPrescriptions = prescriptions.map((prescription) => ({
      ...prescription.toObject(),
      doctor: doctorById.get(prescription.doctorUserId) ?? null,
    }));
    const enrichedLabOrders = labOrders.map((order) => ({
      ...order.toObject(),
      reportStatus: reportByOrderId.get(order.labOrderId)?.status ?? null,
      reportId: reportByOrderId.get(order.labOrderId)?.reportId ?? null,
    }));
    const enrichedBills = bills.map((bill) => ({
      ...bill.toObject(),
      totalAmount: bill.grandTotal,
    }));
    const enrichedPharmacySales = pharmacySales.map((sale) => ({
      ...sale.toObject(),
      status: sale.saleStatus,
      totalAmount: sale.grandTotal,
      itemsCount: sale.items.length,
    }));
    const now = new Date();
    const upcomingAppointments = appointments.filter(
      (appointment) =>
        new Date(appointment.appointmentDate) >= now &&
        !["Completed", "Cancelled", "No Show"].includes(appointment.status),
    );
    const latestVisit = appointments.find((appointment) => new Date(appointment.appointmentDate) <= now) ?? null;
    const latestConsultation = enrichedConsultations[0] ?? null;
    const latestVisitSummary = latestVisit || latestConsultation
      ? {
          appointmentId: latestVisit?.appointmentId ?? latestConsultation?.appointmentId ?? null,
          appointmentDate: latestVisit?.appointmentDate ?? null,
          status: latestVisit?.status ?? latestConsultation?.status ?? null,
          consultationId: latestConsultation?.consultationId ?? null,
          diagnosis: latestConsultation?.diagnosis ?? "",
          advice: latestConsultation?.advice ?? "",
          doctor: latestVisit?.doctor ?? latestConsultation?.doctor ?? null,
        }
      : null;

    return successResponse(
      serializeDoc({
        patient,
        appointments,
        recentAppointments: appointments,
        consultations: enrichedConsultations,
        prescriptions: enrichedPrescriptions,
        latestVisitSummary,
        upcomingAppointments,
        ...(canViewBilling ? { bills: enrichedBills, payments } : {}),
        ...(canViewLabOrders ? { labOrders: enrichedLabOrders } : {}),
        ...(canViewLabReports ? { labReports } : {}),
        ...(canViewPharmacySales ? { pharmacySales: enrichedPharmacySales } : {}),
      }),
      "Patient clinical history fetched",
    );
  } catch (error) {
    return handleApiError(error);
  }
}

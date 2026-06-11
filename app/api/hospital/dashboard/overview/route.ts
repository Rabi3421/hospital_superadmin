import { NextRequest } from "next/server";
import { handleApiError, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import { requireHospitalAuth } from "@/lib/hospital-auth";
import { buildPatientDashboard, requirePatientAuth } from "@/lib/hospital-patient";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Consultation from "@/models/Consultation";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";
import HospitalContactEnquiry from "@/models/HospitalContactEnquiry";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalNotice from "@/models/HospitalNotice";
import HospitalUser from "@/models/HospitalUser";
import LabOrder from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import Medicine from "@/models/Medicine";
import MedicineBatch from "@/models/MedicineBatch";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalAuth(req);
    const hospitalId = session.payload.hospitalId;
    const today = dateRangeFor(new Date());
    await connectDb();

    if (["HOSPITAL_OWNER", "HOSPITAL_ADMIN"].includes(session.user.role)) {
      const [
        totalPatients,
        activePatients,
        todayAppointments,
        waitingToday,
        completedToday,
        totalDoctors,
        totalDepartments,
        totalConsultationsToday,
        completedConsultationsToday,
        prescriptionsIssuedToday,
        todayBills,
        todayPayments,
        dueBills,
        unpaidBills,
        partiallyPaidBills,
        labOrdersToday,
        labReportsReady,
        labReportsPublishedToday,
        activeMedicines,
        activeMedicineBatches,
        todayPharmacySales,
        newAppointmentRequests,
        totalContactEnquiries,
        newContactEnquiries,
        publishedNotices,
      ] = await Promise.all([
        Patient.countDocuments({ hospitalId }),
        Patient.countDocuments({ hospitalId, status: "Active" }),
        Appointment.countDocuments({ hospitalId, appointmentDate: today }),
        Appointment.countDocuments({ hospitalId, appointmentDate: today, status: { $in: ["Scheduled", "Checked In"] } }),
        Appointment.countDocuments({ hospitalId, appointmentDate: today, status: "Completed" }),
        HospitalUser.countDocuments({ hospitalId, role: "DOCTOR", status: "Active" }),
        HospitalDepartment.countDocuments({ hospitalId }),
        Consultation.countDocuments({ hospitalId, createdAt: today }),
        Consultation.countDocuments({ hospitalId, createdAt: today, status: "Completed" }),
        Prescription.countDocuments({ hospitalId, issuedAt: today, status: "Issued" }),
        Bill.find({ hospitalId, createdAt: today, status: { $ne: "Cancelled" } }).select("grandTotal"),
        BillPayment.find({ hospitalId, paymentDate: today, status: "Success" }).select("amount paymentMode"),
        Bill.find({ hospitalId, status: { $in: ["Unpaid", "Partially Paid"] } }).select("dueAmount"),
        Bill.countDocuments({ hospitalId, status: "Unpaid" }),
        Bill.countDocuments({ hospitalId, status: "Partially Paid" }),
        LabOrder.countDocuments({ hospitalId, createdAt: today }),
        LabOrder.countDocuments({ hospitalId, status: "Ready" }),
        LabReport.countDocuments({ hospitalId, publishedAt: today, status: "Published" }),
        Medicine.find({ hospitalId, status: "Active" }).select("medicineId reorderLevel"),
        MedicineBatch.find({ hospitalId, status: "Active" }).select("medicineId quantityAvailable"),
        PharmacySale.find({ hospitalId, createdAt: today, saleStatus: "Completed" }).select("grandTotal"),
        HospitalAppointmentRequest.countDocuments({ hospitalId, status: "New" }),
        HospitalContactEnquiry.countDocuments({ hospitalId }),
        HospitalContactEnquiry.countDocuments({ hospitalId, status: "New" }),
        HospitalNotice.countDocuments({ hospitalId, status: "Published" }),
      ]);
      const stockByMedicine = activeMedicineBatches.reduce<Record<string, number>>((summary, batch) => {
        summary[batch.medicineId] = (summary[batch.medicineId] ?? 0) + batch.quantityAvailable;
        return summary;
      }, {});

      return successResponse({
        role: session.user.role,
        stats: {
          totalPatients,
          activePatients,
          todayAppointments,
          waitingToday,
          completedToday,
          totalDoctors,
          totalDepartments,
          totalConsultationsToday,
          completedConsultationsToday,
          prescriptionsIssuedToday,
          todayBillingAmount: todayBills.reduce((sum, bill) => sum + bill.grandTotal, 0),
          todayCollectionAmount: todayPayments.reduce((sum, payment) => sum + payment.amount, 0),
          totalDueAmount: dueBills.reduce((sum, bill) => sum + bill.dueAmount, 0),
          unpaidBills,
          partiallyPaidBills,
          labOrdersToday,
          labReportsReady,
          labReportsPublishedToday,
          totalActiveMedicines: activeMedicines.length,
          lowStockMedicines: activeMedicines.filter((medicine) => (stockByMedicine[medicine.medicineId] ?? 0) <= medicine.reorderLevel).length,
          todayPharmacySalesAmount: todayPharmacySales.reduce((sum, sale) => sum + sale.grandTotal, 0),
          todayPharmacySalesCount: todayPharmacySales.length,
          newAppointmentRequests,
          totalContactEnquiries,
          newContactEnquiries,
          publishedNotices,
        },
      });
    }

    if (session.user.role === "RECEPTIONIST") {
      const [
        todayAppointments,
        waitingToday,
        checkedInToday,
        inConsultationToday,
        completedToday,
        cancelledToday,
        newPatientsToday,
        totalActivePatients,
        todayPayments,
        unpaidBillsToday,
        newAppointmentRequests,
        confirmedAppointmentRequests,
        totalContactEnquiries,
        newContactEnquiries,
      ] = await Promise.all([
        Appointment.countDocuments({ hospitalId, appointmentDate: today }),
        Appointment.countDocuments({ hospitalId, appointmentDate: today, status: { $in: ["Scheduled", "Checked In"] } }),
        Appointment.countDocuments({ hospitalId, appointmentDate: today, status: "Checked In" }),
        Appointment.countDocuments({ hospitalId, appointmentDate: today, status: "In Consultation" }),
        Appointment.countDocuments({ hospitalId, appointmentDate: today, status: "Completed" }),
        Appointment.countDocuments({ hospitalId, appointmentDate: today, status: "Cancelled" }),
        Patient.countDocuments({ hospitalId, createdAt: today }),
        Patient.countDocuments({ hospitalId, status: "Active" }),
        BillPayment.find({ hospitalId, paymentDate: today, status: "Success" }).select("amount paymentMode"),
        Bill.countDocuments({ hospitalId, createdAt: today, status: "Unpaid" }),
        HospitalAppointmentRequest.countDocuments({ hospitalId, status: "New" }),
        HospitalAppointmentRequest.countDocuments({ hospitalId, status: "Confirmed" }),
        HospitalContactEnquiry.countDocuments({ hospitalId }),
        HospitalContactEnquiry.countDocuments({ hospitalId, status: "New" }),
      ]);

      return successResponse({
        role: session.user.role,
        stats: {
          todayAppointments,
          waitingToday,
          checkedInToday,
          inConsultationToday,
          completedToday,
          cancelledToday,
          newPatientsToday,
          totalActivePatients,
          todayCollectionAmount: todayPayments.reduce((sum, payment) => sum + payment.amount, 0),
          todayPaymentCount: todayPayments.length,
          unpaidBillsToday,
          newAppointmentRequests,
          confirmedAppointmentRequests,
          totalContactEnquiries,
          newContactEnquiries,
        },
      });
    }

    if (session.user.role === "ACCOUNTANT") {
      const [
        totalBills,
        todayBills,
        paidBills,
        partiallyPaidBills,
        unpaidBills,
        cancelledBills,
        todayPayments,
        dueBills,
        recentPayments,
        recentBills,
      ] = await Promise.all([
        Bill.countDocuments({ hospitalId }),
        Bill.find({ hospitalId, createdAt: today, status: { $ne: "Cancelled" } }).select("grandTotal"),
        Bill.countDocuments({ hospitalId, status: "Paid" }),
        Bill.countDocuments({ hospitalId, status: "Partially Paid" }),
        Bill.countDocuments({ hospitalId, status: "Unpaid" }),
        Bill.countDocuments({ hospitalId, status: "Cancelled" }),
        BillPayment.find({ hospitalId, paymentDate: today, status: "Success" }).select("amount paymentMode"),
        Bill.find({ hospitalId, status: { $in: ["Unpaid", "Partially Paid"] } }).select("dueAmount"),
        BillPayment.find({ hospitalId }).sort({ paymentDate: -1, createdAt: -1 }).limit(10).select(
          "paymentId billId patientId amount paymentMode status paymentDate",
        ),
        Bill.find({ hospitalId }).sort({ createdAt: -1 }).limit(10).select(
          "billId patientId status sourceType grandTotal paidAmount dueAmount createdAt",
        ),
      ]);
      const cashCollectionToday = todayPayments
        .filter((payment) => payment.paymentMode === "Cash")
        .reduce((sum, payment) => sum + payment.amount, 0);
      const onlineCollectionToday = todayPayments
        .filter((payment) => payment.paymentMode !== "Cash")
        .reduce((sum, payment) => sum + payment.amount, 0);

      return successResponse({
        role: session.user.role,
        stats: {
          totalBills,
          billsToday: todayBills.length,
          paidBills,
          partiallyPaidBills,
          unpaidBills,
          cancelledBills,
          todayCollection: todayPayments.reduce((sum, payment) => sum + payment.amount, 0),
          cashCollectionToday,
          onlineCollectionToday,
          totalDues: dueBills.reduce((sum, bill) => sum + bill.dueAmount, 0),
          overdueDues: 0,
          recentPayments,
          recentBills,
          todayBillingAmount: todayBills.reduce((sum, bill) => sum + bill.grandTotal, 0),
          todayCollectionAmount: todayPayments.reduce((sum, payment) => sum + payment.amount, 0),
          totalDueAmount: dueBills.reduce((sum, bill) => sum + bill.dueAmount, 0),
          todayPaymentCount: todayPayments.length,
        },
      });
    }

    if (session.user.role === "PHARMACIST") {
      const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const [activeMedicines, activeBatches, expiringSoonBatches, todaySales, soldPrescriptionSales] =
        await Promise.all([
          Medicine.find({ hospitalId, status: "Active" }).select("medicineId reorderLevel"),
          MedicineBatch.find({ hospitalId, status: "Active" }).select("medicineId quantityAvailable"),
          MedicineBatch.countDocuments({ hospitalId, status: "Active", expiryDate: { $gte: new Date(), $lte: soon } }),
          PharmacySale.find({ hospitalId, createdAt: today, saleStatus: "Completed" }).select("grandTotal"),
          PharmacySale.find({ hospitalId, prescriptionId: { $ne: "" }, saleStatus: "Completed" }).select("prescriptionId"),
        ]);
      const stockByMedicine = activeBatches.reduce<Record<string, number>>((summary, batch) => {
        summary[batch.medicineId] = (summary[batch.medicineId] ?? 0) + batch.quantityAvailable;
        return summary;
      }, {});
      const soldPrescriptionIds = soldPrescriptionSales
        .map((sale) => sale.prescriptionId)
        .filter((prescriptionId): prescriptionId is string => Boolean(prescriptionId));
      const issuedPrescriptionsPendingSale = await Prescription.countDocuments({
        hospitalId,
        status: "Issued",
        prescriptionId: { $nin: soldPrescriptionIds },
      });

      return successResponse({
        role: session.user.role,
        stats: {
          totalActiveMedicines: activeMedicines.length,
          lowStockMedicines: activeMedicines.filter((medicine) => (stockByMedicine[medicine.medicineId] ?? 0) <= medicine.reorderLevel).length,
          expiringSoonBatches,
          todaySalesAmount: todaySales.reduce((sum, sale) => sum + sale.grandTotal, 0),
          todaySalesCount: todaySales.length,
          issuedPrescriptionsPendingSale,
        },
      });
    }

    if (session.user.role === "DOCTOR") {
      const [
        myTodayAppointments,
        myWaitingAppointments,
        myInConsultation,
        myCompletedToday,
        myDraftConsultations,
        myIssuedPrescriptionsToday,
        myLabOrdersToday,
        myLabReportsReady,
      ] = await Promise.all([
        Appointment.countDocuments({ hospitalId, doctorUserId: session.payload.userId, appointmentDate: today }),
        Appointment.countDocuments({
          hospitalId,
          doctorUserId: session.payload.userId,
          appointmentDate: today,
          status: { $in: ["Scheduled", "Checked In"] },
        }),
        Appointment.countDocuments({
          hospitalId,
          doctorUserId: session.payload.userId,
          appointmentDate: today,
          status: "In Consultation",
        }),
        Appointment.countDocuments({
          hospitalId,
          doctorUserId: session.payload.userId,
          appointmentDate: today,
          status: "Completed",
        }),
        Consultation.countDocuments({
          hospitalId,
          doctorUserId: session.payload.userId,
          status: "Draft",
        }),
        Prescription.countDocuments({
          hospitalId,
          doctorUserId: session.payload.userId,
          issuedAt: today,
          status: "Issued",
        }),
        LabOrder.countDocuments({ hospitalId, doctorUserId: session.payload.userId, createdAt: today }),
        LabReport.countDocuments({ hospitalId, doctorUserId: session.payload.userId, status: "Published" }),
      ]);
      return successResponse({
        role: session.user.role,
        stats: {
          myTodayAppointments,
          myWaitingAppointments,
          myInConsultation,
          myCompletedToday,
          myDraftConsultations,
          myIssuedPrescriptionsToday,
          myLabOrdersToday,
          myLabReportsReady,
        },
      });
    }

    if (session.user.role === "LAB_TECHNICIAN") {
      const [todayOrders, pendingOrders, processingOrders, readyReports, draftReports, publishedReportsToday] =
        await Promise.all([
          LabOrder.countDocuments({ hospitalId, createdAt: today }),
          LabOrder.countDocuments({ hospitalId, status: { $in: ["Ordered", "Sample Collected"] } }),
          LabOrder.countDocuments({ hospitalId, status: "Processing" }),
          LabOrder.countDocuments({ hospitalId, status: "Ready" }),
          LabReport.countDocuments({ hospitalId, status: "Draft" }),
          LabReport.countDocuments({ hospitalId, publishedAt: today, status: "Published" }),
        ]);

      return successResponse({
        role: session.user.role,
        stats: { todayOrders, pendingOrders, processingOrders, readyReports, draftReports, publishedReportsToday },
      });
    }

    if (session.user.role === "PATIENT") {
      const patientSession = await requirePatientAuth(req);
      return successResponse({
        role: session.user.role,
        stats: await buildPatientDashboard(patientSession),
      });
    }

    const safeZeroStats: Record<string, Record<string, number>> = {
      NURSE: { assignedPatients: 0, pendingVitals: 0, appointments: 0 },
    };

    return successResponse({
      role: session.user.role,
      stats: safeZeroStats[session.user.role] ?? {},
      note: "These modules are not available yet; values are safe zero placeholders.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

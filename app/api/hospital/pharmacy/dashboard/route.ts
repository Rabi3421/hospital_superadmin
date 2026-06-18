import { NextRequest } from "next/server";
import { handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { dateRangeFor, endOfDay } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import Medicine from "@/models/Medicine";
import MedicineBatch from "@/models/MedicineBatch";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Prescription from "@/models/Prescription";
import StockMovement from "@/models/StockMovement";

export async function GET(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "pharmacy_dashboard_view");
    const hospitalId = session.payload.hospitalId;
    const today = dateRangeFor(new Date());
    const soon = endOfDay(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    await connectDb();

    const [totalMedicines, medicines, activeBatches, todaySales, cancelledSalesToday, issuedPrescriptionsWithSales, stockMovementsToday] = await Promise.all([
      Medicine.countDocuments({ hospitalId }),
      Medicine.find({ hospitalId, status: "Active" }).select("medicineId name reorderLevel"),
      MedicineBatch.find({ hospitalId, status: "Active", expiryDate: { $gte: new Date() } }).select(
        "medicineId batchId batchNumber quantityAvailable expiryDate",
      ),
      PharmacySale.find({ hospitalId, createdAt: today, saleStatus: "Completed" }).select("saleId patientId grandTotal createdAt"),
      PharmacySale.countDocuments({ hospitalId, createdAt: today, saleStatus: "Cancelled" }),
      PharmacySale.find({ hospitalId, prescriptionId: { $ne: "" }, saleStatus: "Completed" }).select("prescriptionId"),
      StockMovement.countDocuments({ hospitalId, createdAt: today }),
    ]);

    const stockByMedicine = activeBatches.reduce<Record<string, number>>((summary, batch) => {
      summary[batch.medicineId] = (summary[batch.medicineId] ?? 0) + batch.quantityAvailable;
      return summary;
    }, {});
    const soldPrescriptionIds = issuedPrescriptionsWithSales
      .map((sale) => sale.prescriptionId)
      .filter((prescriptionId): prescriptionId is string => Boolean(prescriptionId));
    const [
      expiringSoonBatches,
      expiredBatches,
      unpaidSales,
      issuedPrescriptionsPendingSale,
      expiringSoonBatchesList,
      pendingPrescriptionsList,
    ] = await Promise.all([
      MedicineBatch.countDocuments({ hospitalId, status: "Active", expiryDate: { $gte: new Date(), $lte: soon } }),
      MedicineBatch.countDocuments({ hospitalId, $or: [{ status: "Expired" }, { expiryDate: { $lt: new Date() } }] }),
      PharmacySale.countDocuments({ hospitalId, saleStatus: "Completed", paymentStatus: { $ne: "Paid" } }),
      Prescription.countDocuments({
        hospitalId,
        status: "Issued",
        prescriptionId: { $nin: soldPrescriptionIds },
      }),
      MedicineBatch.find({ hospitalId, status: "Active", expiryDate: { $gte: new Date(), $lte: soon } })
        .sort({ expiryDate: 1 }).limit(10).select("batchId medicineId batchNumber expiryDate quantityAvailable"),
      Prescription.find({ hospitalId, status: "Issued", prescriptionId: { $nin: soldPrescriptionIds } })
        .sort({ issuedAt: -1, createdAt: -1 }).limit(10).select("prescriptionId patientId doctorUserId issuedAt createdAt"),
    ]);

    const lowStockMedicinesList = medicines
      .filter((medicine) => (stockByMedicine[medicine.medicineId] ?? 0) <= medicine.reorderLevel)
      .slice(0, 10)
      .map((medicine) => ({
        ...serializeDoc(medicine),
        availableStock: stockByMedicine[medicine.medicineId] ?? 0,
      }));

    const allPatientIds = [
      ...new Set([
        ...todaySales.map((s) => s.patientId),
        ...pendingPrescriptionsList.map((p) => p.patientId),
      ]),
    ];
    const patients = await Patient.find({ hospitalId, patientId: { $in: allPatientIds } }).select("patientId name phone");
    const patientMap = new Map(patients.map((p) => [p.patientId, p]));

    const medicineLookup = new Map(medicines.map((m) => [m.medicineId, m]));

    return successResponse({
      totalMedicines,
      activeMedicines: medicines.length,
      totalActiveMedicines: medicines.length,
      lowStockMedicines: lowStockMedicinesList.length,
      outOfStockMedicines: medicines.filter((medicine) => (stockByMedicine[medicine.medicineId] ?? 0) <= 0).length,
      expiringSoonBatches,
      expiredBatches,
      todaySalesAmount: todaySales.reduce((sum, sale) => sum + sale.grandTotal, 0),
      todaySalesCount: todaySales.length,
      salesToday: todaySales.length,
      completedSalesToday: todaySales.length,
      cancelledSalesToday,
      revenueToday: todaySales.reduce((sum, sale) => sum + sale.grandTotal, 0),
      unpaidSales,
      stockMovementsToday,
      issuedPrescriptionsPendingSale,
      pendingPrescriptions: issuedPrescriptionsPendingSale,
      lowStockMedicinesList,
      expiringSoonBatchesList: expiringSoonBatchesList.map((batch) => ({
        ...serializeDoc(batch),
        medicineName: medicineLookup.get(batch.medicineId)?.name ?? batch.medicineId,
      })),
      pendingPrescriptionsList: pendingPrescriptionsList.map((rx) => ({
        ...serializeDoc(rx),
        patient: patientMap.get(rx.patientId) ? serializeDoc(patientMap.get(rx.patientId)) : null,
      })),
      todaySalesList: todaySales.slice(0, 10).map((sale) => ({
        ...serializeDoc(sale),
        patient: patientMap.get(sale.patientId) ? serializeDoc(patientMap.get(sale.patientId)) : null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

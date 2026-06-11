import { z } from "zod";
import { connectDb } from "@/lib/db";
import { dateRangeFor } from "@/lib/hospital-clinical";
import Appointment from "@/models/Appointment";
import Bill from "@/models/Bill";
import BillPayment from "@/models/BillPayment";
import Hospital from "@/models/Hospital";
import HospitalAppointmentRequest from "@/models/HospitalAppointmentRequest";
import HospitalContactEnquiry from "@/models/HospitalContactEnquiry";
import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalDoctorPublicProfile from "@/models/HospitalDoctorPublicProfile";
import HospitalUser from "@/models/HospitalUser";
import LabOrder from "@/models/LabOrder";
import Patient from "@/models/Patient";
import PharmacySale from "@/models/PharmacySale";
import Subscription from "@/models/Subscription";

export const hospitalSettingsSchema = z.object({
  currency: z.string().min(2).optional(),
  timezone: z.string().min(2).optional(),
  appointmentTokenPrefix: z.string().min(1).optional(),
  receiptPrefix: z.string().min(1).optional(),
  defaultConsultationFee: z.coerce.number().min(0).optional(),
  workingHours: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export const hospitalProfileUpdateSchema = z.object({
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
  settings: hospitalSettingsSchema.optional(),
});

export const departmentCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  icon: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
  sortOrder: z.coerce.number().optional().default(0),
});
export const departmentUpdateSchema = departmentCreateSchema.partial();

export const doctorProfileCreateSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(2),
  departmentId: z.string().optional(),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  experienceYears: z.coerce.number().min(0).optional().default(0),
  consultationFee: z.coerce.number().min(0).optional().default(0),
  photoUrl: z.string().url().or(z.literal("")).optional(),
  bio: z.string().optional(),
  availableDays: z.array(z.string()).optional().default([]),
  availableTime: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
});
export const doctorProfileUpdateSchema = doctorProfileCreateSchema.partial();

export async function validateDoctorProfileReferences(
  hospitalId: string,
  input: { userId?: string; departmentId?: string },
) {
  if (input.userId) {
    const doctor = await HospitalUser.findOne({ _id: input.userId, hospitalId, role: "DOCTOR" });
    if (!doctor) throw new Error("Doctor user not found for this hospital");
  }
  if (input.departmentId) {
    const department = await HospitalDepartment.findOne({ _id: input.departmentId, hospitalId });
    if (!department) throw new Error("Department not found for this hospital");
  }
}

export async function getSetupProgress(hospitalId: string) {
  await connectDb();
  const hospital = await Hospital.findOne({ hospitalId });
  if (!hospital) throw new Error("Hospital not found for this hospital");

  const [
    ownerCredentialCreated,
    departments,
    doctorUsers,
    doctorProfiles,
    receptionists,
    accountants,
    appointments,
    bills,
    labOrders,
    pharmacySales,
  ] = await Promise.all([
    HospitalUser.exists({ hospitalId, role: "HOSPITAL_OWNER", status: "Active" }),
    HospitalDepartment.countDocuments({ hospitalId, status: "Active" }),
    HospitalUser.countDocuments({ hospitalId, role: "DOCTOR", status: "Active" }),
    HospitalDoctorPublicProfile.countDocuments({ hospitalId, status: "Active" }),
    HospitalUser.countDocuments({ hospitalId, role: "RECEPTIONIST", status: "Active" }),
    HospitalUser.countDocuments({ hospitalId, role: "ACCOUNTANT", status: "Active" }),
    Appointment.countDocuments({ hospitalId }),
    Bill.countDocuments({ hospitalId }),
    LabOrder.countDocuments({ hospitalId }),
    PharmacySale.countDocuments({ hospitalId }),
  ]);

  const items = [
    ["hospitalProfileCompleted", "Complete hospital profile", Boolean(hospital.name && hospital.ownerName && hospital.ownerPhone && hospital.address), "Add the hospital identity, owner contact, and address."],
    ["ownerCredentialCreated", "Create owner credential", Boolean(ownerCredentialCreated), "Create an active HOSPITAL_OWNER user."],
    ["atLeastOneDepartment", "Add a department", departments > 0, "Create at least one active department."],
    ["atLeastOneDoctorUser", "Add a doctor login", doctorUsers > 0, "Create at least one active DOCTOR user."],
    ["atLeastOneDoctorProfile", "Publish a doctor profile", doctorProfiles > 0, "Create at least one active public doctor profile."],
    ["atLeastOneReceptionist", "Add a receptionist", receptionists > 0, "Create at least one active RECEPTIONIST user."],
    ["atLeastOneAccountant", "Add an accountant", accountants > 0, "Create at least one active ACCOUNTANT user."],
    ["publicWebsiteLive", "Publish public website", hospital.websiteStatus === "Live", "Ask superadmin to set the public website live when ready."],
    ["appointmentFlowReady", "Test appointment flow", appointments > 0, "Create the first appointment."],
    ["billingReady", "Test billing flow", bills > 0, "Create the first bill."],
    ["labReady", "Test lab flow", labOrders > 0, "Create the first lab order."],
    ["pharmacyReady", "Test pharmacy flow", pharmacySales > 0, "Create the first pharmacy sale."],
  ].map(([key, label, completed, actionHint]) => ({ key, label, completed, actionHint }));

  return {
    items,
    completionPercentage: Math.round((items.filter((item) => item.completed).length / items.length) * 100),
  };
}

export async function getManagementDashboard(hospitalId: string, includeSubscription: boolean) {
  await connectDb();
  const today = dateRangeFor(new Date());
  const [
    hospital,
    subscription,
    users,
    totalDepartments,
    activeDepartments,
    totalDoctors,
    activeDoctors,
    totalPatients,
    todayAppointments,
    todayPayments,
    dueBills,
    labOrdersToday,
    pharmacySalesToday,
    pendingAppointmentRequests,
    unreadContactEnquiries,
    setupProgress,
  ] = await Promise.all([
    Hospital.findOne({ hospitalId }).select("hospitalId name slug type logoUrl status websiteStatus subscriptionPlan trialEndDate nextBillingDate"),
    includeSubscription ? Subscription.findOne({ hospitalId }).sort({ createdAt: -1 }).select("planName status billingCycle endDate nextBillingDate") : null,
    HospitalUser.find({ hospitalId }).select("role"),
    HospitalDepartment.countDocuments({ hospitalId }),
    HospitalDepartment.countDocuments({ hospitalId, status: "Active" }),
    HospitalDoctorPublicProfile.countDocuments({ hospitalId }),
    HospitalDoctorPublicProfile.countDocuments({ hospitalId, status: "Active" }),
    Patient.countDocuments({ hospitalId }),
    Appointment.countDocuments({ hospitalId, appointmentDate: today }),
    BillPayment.find({ hospitalId, paymentDate: today, status: "Success" }).select("amount"),
    Bill.find({ hospitalId, status: { $in: ["Unpaid", "Partially Paid"] } }).select("dueAmount"),
    LabOrder.countDocuments({ hospitalId, createdAt: today }),
    PharmacySale.find({ hospitalId, createdAt: today, saleStatus: "Completed" }).select("grandTotal"),
    HospitalAppointmentRequest.countDocuments({ hospitalId, status: "New" }),
    HospitalContactEnquiry.countDocuments({ hospitalId, status: "New" }),
    getSetupProgress(hospitalId),
  ]);
  const usersByRole = users.reduce<Record<string, number>>((result, user) => {
    result[user.role] = (result[user.role] ?? 0) + 1;
    return result;
  }, {});

  return {
    hospital,
    ...(includeSubscription ? { subscription } : {}),
    totalUsers: users.length,
    usersByRole,
    totalDepartments,
    activeDepartments,
    totalDoctors,
    activeDoctors,
    totalPatients,
    todayAppointments,
    todayRevenue: todayPayments.reduce((sum, payment) => sum + payment.amount, 0),
    pendingDues: dueBills.reduce((sum, bill) => sum + bill.dueAmount, 0),
    labOrdersToday,
    pharmacySalesToday: pharmacySalesToday.reduce((sum, sale) => sum + sale.grandTotal, 0),
    pendingAppointmentRequests,
    unreadContactEnquiries,
    setupProgress,
  };
}

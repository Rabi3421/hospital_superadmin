import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

type CapacityHospital = {
  hospitalId: string;
  subscriptionPlan: string;
  maxDoctors: number;
  maxStaff: number;
  maxPatients: number;
};

export async function ensureHospitalCapacity(
  hospital: CapacityHospital,
  resource: "doctor" | "staff" | "patient",
) {
  if (resource === "patient") {
    const count = await Patient.countDocuments({ hospitalId: hospital.hospitalId });
    if (count >= hospital.maxPatients) {
      throw new Error(`Subscription limit reached: ${hospital.subscriptionPlan} allows ${hospital.maxPatients} patients`);
    }
    return;
  }

  if (resource === "doctor") {
    const doctors = await HospitalUser.countDocuments({ hospitalId: hospital.hospitalId, role: "DOCTOR" });
    if (doctors >= hospital.maxDoctors) {
      throw new Error(`Subscription limit reached: ${hospital.subscriptionPlan} allows ${hospital.maxDoctors} doctors`);
    }
  }

  const staff = await HospitalUser.countDocuments({
    hospitalId: hospital.hospitalId,
    role: { $ne: "PATIENT" },
  });
  if (staff >= hospital.maxStaff) {
    throw new Error(`Subscription limit reached: ${hospital.subscriptionPlan} allows ${hospital.maxStaff} staff users`);
  }
}

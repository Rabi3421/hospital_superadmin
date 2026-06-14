import type { HospitalRole } from "@/lib/hospital-permissions";

const allDashboardRoles: HospitalRole[] = [
  "HOSPITAL_OWNER",
  "HOSPITAL_ADMIN",
  "RECEPTIONIST",
  "DOCTOR",
  "NURSE",
  "PHARMACIST",
  "LAB_TECHNICIAN",
  "ACCOUNTANT",
  "PATIENT",
];

export const subscriptionPlans = [
  {
    name: "Free Starter",
    description: "One month of the complete platform so the hospital can evaluate every workflow.",
    priceOptions: [0],
    maxDoctors: 10,
    maxStaff: 50,
    maxPatients: 5000,
    allowedRoles: allDashboardRoles,
    features: ["30-day full-access trial", "All dashboards", "All clinical and operational modules"],
  },
  {
    name: "Core Care",
    description: "Focused plan for hospitals using owner, doctor, and patient dashboards.",
    priceOptions: [3000, 2000],
    maxDoctors: 20,
    maxStaff: 25,
    maxPatients: 15000,
    allowedRoles: ["HOSPITAL_OWNER", "DOCTOR", "PATIENT"] satisfies HospitalRole[],
    features: ["Hospital owner dashboard", "Doctor dashboard", "Patient dashboard"],
  },
  {
    name: "Complete Care",
    description: "Complete hospital operations with every dashboard and role enabled.",
    priceOptions: [5000, 4000],
    maxDoctors: 75,
    maxStaff: 400,
    maxPatients: 100000,
    allowedRoles: allDashboardRoles,
    features: ["All dashboards", "Full clinical operations", "Reception, lab, pharmacy, and finance"],
  },
] as const;

export type SubscriptionPlanName = (typeof subscriptionPlans)[number]["name"];

export const subscriptionPlanNames = subscriptionPlans.map((plan) => plan.name) as [
  SubscriptionPlanName,
  ...SubscriptionPlanName[],
];

export function getSubscriptionPlan(name: string) {
  return subscriptionPlans.find((plan) => plan.name === name);
}

export function normalizeSubscriptionPlanName(name: string): SubscriptionPlanName {
  return getSubscriptionPlan(name)?.name ?? "Complete Care";
}

export function getPlanPrice(planName: string, price: number) {
  const plan = getSubscriptionPlan(planName);
  return plan?.priceOptions.find((option) => option === price);
}

export function roleAllowedForPlan(planName: string, role: HospitalRole) {
  const plan = getSubscriptionPlan(planName);
  // Preserve access for legacy plans until superadmin explicitly migrates them.
  return plan ? (plan.allowedRoles as readonly HospitalRole[]).includes(role) : true;
}

export function trialIsActive(hospital: { status: string; trialEndDate?: Date | string }) {
  return hospital.status === "Trial" && Boolean(hospital.trialEndDate) && new Date(hospital.trialEndDate!).getTime() > Date.now();
}

export function roleAllowedForHospital(
  hospital: { status: string; subscriptionPlan: string; trialEndDate?: Date | string },
  role: HospitalRole,
) {
  return trialIsActive(hospital) || (hospital.status === "Active" && roleAllowedForPlan(hospital.subscriptionPlan, role));
}

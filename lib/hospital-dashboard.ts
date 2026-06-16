import { type HospitalRole } from "@/lib/hospital-permissions";

export type HospitalNavigationItem = {
  label: string;
  route: string;
};

export function getDashboardRouteForRole(role: HospitalRole) {
  const routes: Record<HospitalRole, string> = {
    HOSPITAL_ADMIN: "/dashboard/admin",
    MANAGING_DIRECTOR: "/dashboard/director",
    RECEPTIONIST: "/dashboard/receptionist",
    DOCTOR: "/dashboard/doctor",
    NURSE: "/dashboard/nurse",
    PHARMACIST: "/dashboard/pharmacy",
    LAB_TECHNICIAN: "/dashboard/lab",
    ACCOUNTANT: "/dashboard/accountant",
    PATIENT: "/dashboard/patient",
  };

  return routes[role];
}

export function getAllowedNavigationForRole(role: HospitalRole): HospitalNavigationItem[] {
  if (role === "HOSPITAL_ADMIN") {
    const base = getDashboardRouteForRole(role);
    return [
      { label: "Overview", route: base },
      { label: "Setup", route: `${base}/setup` },
      { label: "Hospital Profile", route: `${base}/profile` },
      { label: "Staff Users", route: `${base}/users` },
      { label: "Departments", route: `${base}/departments` },
      { label: "Doctor Profiles", route: `${base}/doctors` },
      { label: "Patients", route: `${base}/patients` },
      { label: "Appointments", route: `${base}/appointments` },
      { label: "Billing", route: `${base}/billing` },
      { label: "Lab", route: `${base}/lab` },
      { label: "Pharmacy", route: `${base}/pharmacy` },
      { label: "Website Content", route: `${base}/content` },
      { label: "Reports", route: `${base}/reports` },
      { label: "Settings", route: `${base}/settings` },
    ];
  }

  if (role === "MANAGING_DIRECTOR") {
    const base = getDashboardRouteForRole(role);
    return [
      { label: "Overview", route: base },
      { label: "Setup", route: `${base}/setup` },
      { label: "Hospital Profile", route: `${base}/profile` },
      { label: "Staff Users", route: `${base}/users` },
      { label: "Departments", route: `${base}/departments` },
      { label: "Doctor Profiles", route: `${base}/doctors` },
      { label: "Doctor Slots", route: `${base}/open-slots` },
      { label: "Patients", route: `${base}/patients` },
      { label: "Appointments", route: `${base}/appointments` },
      { label: "Queue Tracking", route: `${base}/queue-tracking` },
      { label: "Patient Records", route: `${base}/records` },
      { label: "Billing", route: `${base}/billing` },
      { label: "Lab", route: `${base}/lab` },
      { label: "Pharmacy", route: `${base}/pharmacy` },
      { label: "Website Content", route: `${base}/content` },
      { label: "Reports", route: `${base}/reports` },
      { label: "Settings", route: `${base}/settings` },
    ];
  }

  if (role === "RECEPTIONIST") {
    const base = getDashboardRouteForRole(role);
    return [
      { label: "Overview", route: base },
      { label: "Patients", route: `${base}/patients` },
      { label: "Appointments", route: `${base}/appointments` },
      { label: "Today Queue", route: `${base}/today-queue` },
      { label: "Patient Search", route: `${base}/patient-search` },
      { label: "Contact Enquiries", route: `${base}/contact-enquiries` },
      { label: "Appointment Requests", route: `${base}/appointment-requests` },
    ];
  }

  if (role === "DOCTOR") {
    const base = getDashboardRouteForRole(role);
    return [
      { label: "Overview", route: base },
      { label: "Clinical Inbox", route: `${base}/inbox` },
      { label: "Queue", route: `${base}/queue` },
      { label: "Consultations", route: `${base}/consultations` },
      { label: "Prescriptions", route: `${base}/prescriptions` },
      { label: "Patient History", route: `${base}/patient-history` },
      { label: "Lab Orders", route: `${base}/lab-orders` },
    ];
  }

  if (role === "LAB_TECHNICIAN") {
    const base = getDashboardRouteForRole(role);
    return [
      { label: "Overview", route: base },
      { label: "Lab Tests", route: `${base}/tests` },
      { label: "Lab Orders", route: `${base}/orders` },
      { label: "Lab Reports", route: `${base}/reports` },
    ];
  }

  if (role === "PHARMACIST") {
    const base = getDashboardRouteForRole(role);
    return [
      { label: "Overview", route: base },
      { label: "Medicines", route: `${base}/medicines` },
      { label: "Stock", route: `${base}/stock` },
      { label: "Prescriptions", route: `${base}/prescriptions` },
      { label: "Sales", route: `${base}/sales` },
    ];
  }

  if (role === "ACCOUNTANT") {
    const base = getDashboardRouteForRole(role);
    return [
      { label: "Overview", route: base },
      { label: "Bills", route: `${base}/bills` },
      { label: "Payments", route: `${base}/payments` },
      { label: "Receipts", route: `${base}/receipts` },
      { label: "Reports", route: `${base}/reports` },
      { label: "Daily Collection", route: `${base}/daily-collection` },
      { label: "Dues", route: `${base}/dues` },
      { label: "Summary", route: `${base}/summary` },
    ];
  }

  if (role === "PATIENT") {
    const base = getDashboardRouteForRole(role);
    return [
      { label: "Overview", route: base },
      { label: "Profile", route: `${base}/profile` },
      { label: "Appointments", route: `${base}/appointments` },
      { label: "Book Appointment", route: `${base}/book-appointment` },
      { label: "Appointment Requests", route: `${base}/appointment-requests` },
      { label: "Prescriptions", route: `${base}/prescriptions` },
      { label: "Lab Orders", route: `${base}/lab-orders` },
      { label: "Lab Reports", route: `${base}/lab-reports` },
      { label: "Bills", route: `${base}/bills` },
      { label: "Pharmacy History", route: `${base}/pharmacy` },
      { label: "Medical History", route: `${base}/medical-history` },
    ];
  }

  const navigation: Record<HospitalRole, string[]> = {
    HOSPITAL_ADMIN: [],
    MANAGING_DIRECTOR: [],
    RECEPTIONIST: [],
    DOCTOR: [],
    NURSE: ["Overview", "Patients", "Vitals", "Appointments"],
    PHARMACIST: [],
    LAB_TECHNICIAN: [],
    ACCOUNTANT: [],
    PATIENT: [],
  };

  return navigation[role].map((label) => ({
    label,
    route: `${getDashboardRouteForRole(role)}/${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  }));
}

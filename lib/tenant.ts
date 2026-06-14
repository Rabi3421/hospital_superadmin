import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import Hospital from "@/models/Hospital";
import { trialIsActive } from "@/lib/subscription-plans";
import { reconcileSubscriptionBilling } from "@/lib/subscription-billing";

export function getHospitalIdFromRequest(req: NextRequest) {
  return (
    req.headers.get("x-hospital-id")?.trim() ||
    req.nextUrl.searchParams.get("hospitalId")?.trim() ||
    ""
  );
}

export async function requireValidHospital(req: NextRequest) {
  const hospitalId = getHospitalIdFromRequest(req);
  if (!hospitalId) {
    throw new Error("Hospital ID is required");
  }

  await connectDb();
  await reconcileSubscriptionBilling(hospitalId);
  const hospital = await Hospital.findOne({ hospitalId });
  if (!hospital) {
    throw new Error("Hospital not found");
  }

  if (["Suspended", "Cancelled"].includes(hospital.status)) {
    throw new Error(`Hospital is ${hospital.status.toLowerCase()}`);
  }
  if (hospital.status === "Trial" && !trialIsActive(hospital)) {
    throw new Error("Hospital trial has expired");
  }

  return hospital;
}

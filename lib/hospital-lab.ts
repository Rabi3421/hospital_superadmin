import LabOrder, { type LabOrderStatus, type LabOrderTestItem } from "@/models/LabOrder";
import LabReport from "@/models/LabReport";
import LabTest from "@/models/LabTest";

export async function generateLabTestId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `TEST-${year}-`;
  const latest = await LabTest.findOne({ hospitalId, testId: { $regex: `^${prefix}` } })
    .sort({ testId: -1 })
    .select("testId");
  const nextNumber = latest?.testId ? Number(latest.testId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateLabOrderId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `LAB-${year}-`;
  const latest = await LabOrder.findOne({ hospitalId, labOrderId: { $regex: `^${prefix}` } })
    .sort({ labOrderId: -1 })
    .select("labOrderId");
  const nextNumber = latest?.labOrderId ? Number(latest.labOrderId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function generateLabReportId(hospitalId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `RPT-${year}-`;
  const latest = await LabReport.findOne({ hospitalId, reportId: { $regex: `^${prefix}` } })
    .sort({ reportId: -1 })
    .select("reportId");
  const nextNumber = latest?.reportId ? Number(latest.reportId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber || 1).padStart(4, "0")}`;
}

export async function validateLabOrderTests(testIds: string[], hospitalId: string) {
  if (!testIds.length) throw new Error("At least one lab test is required");
  const tests = await LabTest.find({ hospitalId, testId: { $in: testIds }, status: "Active" });
  if (tests.length !== new Set(testIds).size) throw new Error("One or more lab tests are invalid or inactive");

  const testById = new Map(tests.map((test) => [test.testId, test]));
  return testIds.map((testId) => {
    const test = testById.get(testId);
    if (!test) throw new Error("One or more lab tests are invalid or inactive");
    return {
      testId: test.testId,
      testName: test.name,
      price: test.price,
      status: "Ordered" as LabOrderStatus,
      needsMapping: false,
    };
  });
}

export function calculateLabOrderAmount(tests: LabOrderTestItem[]) {
  return tests.reduce((sum, test) => sum + Number(test.price || 0), 0);
}

export function getLabOrderOverallStatus(tests: LabOrderTestItem[]): LabOrderStatus {
  if (!tests.length) return "Ordered";
  if (tests.every((test) => test.status === "Cancelled")) return "Cancelled";
  if (tests.every((test) => test.status === "Completed")) return "Completed";
  if (tests.every((test) => ["Ready", "Completed"].includes(test.status))) return "Ready";
  if (tests.some((test) => test.status === "Processing")) return "Processing";
  if (tests.some((test) => test.status === "Sample Collected")) return "Sample Collected";
  return "Ordered";
}

export async function updateLabOrderStatusFromTests(labOrderId: string, hospitalId: string) {
  const order = await LabOrder.findOne({ hospitalId, labOrderId });
  if (!order) throw new Error("Lab order not found");
  if (order.status === "Cancelled") return order;
  order.status = getLabOrderOverallStatus(order.tests);
  await order.save();
  return order;
}

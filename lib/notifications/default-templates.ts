import type { NotificationChannel } from "./types";

export interface DefaultTemplate {
  eventType: string;
  channel: NotificationChannel;
  name: string;
  body: string;
  variables: string[];
}

export const defaultTemplates: DefaultTemplate[] = [
  // APPOINTMENT_BOOKED
  {
    eventType: "APPOINTMENT_BOOKED",
    channel: "WHATSAPP",
    name: "Appointment Booked - WhatsApp",
    body: "Hi {{patientName}}, your appointment with Dr. {{doctorName}} is booked on {{appointmentDate}} at {{appointmentTime}}. Token: {{tokenNumber}}. - {{hospitalName}}",
    variables: ["patientName", "doctorName", "appointmentDate", "appointmentTime", "tokenNumber", "hospitalName"],
  },
  {
    eventType: "APPOINTMENT_BOOKED",
    channel: "SMS",
    name: "Appointment Booked - SMS",
    body: "Hi {{patientName}}, your appointment with Dr. {{doctorName}} is booked on {{appointmentDate}} at {{appointmentTime}}. Token: {{tokenNumber}}. - {{hospitalName}}",
    variables: ["patientName", "doctorName", "appointmentDate", "appointmentTime", "tokenNumber", "hospitalName"],
  },

  // APPOINTMENT_CHECKED_IN
  {
    eventType: "APPOINTMENT_CHECKED_IN",
    channel: "WHATSAPP",
    name: "Appointment Checked In - WhatsApp",
    body: "Hi {{patientName}}, you are checked in. Your token is {{tokenNumber}}. Please wait for your turn. - {{hospitalName}}",
    variables: ["patientName", "tokenNumber", "hospitalName"],
  },
  {
    eventType: "APPOINTMENT_CHECKED_IN",
    channel: "SMS",
    name: "Appointment Checked In - SMS",
    body: "Hi {{patientName}}, you are checked in. Your token is {{tokenNumber}}. Please wait for your turn. - {{hospitalName}}",
    variables: ["patientName", "tokenNumber", "hospitalName"],
  },

  // QUEUE_TURN_NEAR
  {
    eventType: "QUEUE_TURN_NEAR",
    channel: "WHATSAPP",
    name: "Queue Turn Near - WhatsApp",
    body: "Hi {{patientName}}, your turn is coming soon. Current token: {{currentToken}}. Your token: {{tokenNumber}}. - {{hospitalName}}",
    variables: ["patientName", "currentToken", "tokenNumber", "hospitalName"],
  },
  {
    eventType: "QUEUE_TURN_NEAR",
    channel: "SMS",
    name: "Queue Turn Near - SMS",
    body: "Hi {{patientName}}, your turn is coming soon. Current token: {{currentToken}}. Your token: {{tokenNumber}}. - {{hospitalName}}",
    variables: ["patientName", "currentToken", "tokenNumber", "hospitalName"],
  },

  // PATIENT_READY_FOR_DOCTOR
  {
    eventType: "PATIENT_READY_FOR_DOCTOR",
    channel: "WHATSAPP",
    name: "Patient Ready for Doctor - WhatsApp",
    body: "Hi {{patientName}}, you are ready for doctor consultation. Please stay near the consultation room. - {{hospitalName}}",
    variables: ["patientName", "hospitalName"],
  },
  {
    eventType: "PATIENT_READY_FOR_DOCTOR",
    channel: "SMS",
    name: "Patient Ready for Doctor - SMS",
    body: "Hi {{patientName}}, you are ready for doctor consultation. Please stay near the consultation room. - {{hospitalName}}",
    variables: ["patientName", "hospitalName"],
  },

  // PRESCRIPTION_ISSUED
  {
    eventType: "PRESCRIPTION_ISSUED",
    channel: "WHATSAPP",
    name: "Prescription Issued - WhatsApp",
    body: "Hi {{patientName}}, your prescription from Dr. {{doctorName}} is ready in your patient portal. - {{hospitalName}}",
    variables: ["patientName", "doctorName", "hospitalName"],
  },
  {
    eventType: "PRESCRIPTION_ISSUED",
    channel: "SMS",
    name: "Prescription Issued - SMS",
    body: "Hi {{patientName}}, your prescription from Dr. {{doctorName}} is ready in your patient portal. - {{hospitalName}}",
    variables: ["patientName", "doctorName", "hospitalName"],
  },

  // LAB_REPORT_READY
  {
    eventType: "LAB_REPORT_READY",
    channel: "WHATSAPP",
    name: "Lab Report Ready - WhatsApp",
    body: "Hi {{patientName}}, your lab report is ready. Please check your patient portal or contact reception. - {{hospitalName}}",
    variables: ["patientName", "hospitalName"],
  },
  {
    eventType: "LAB_REPORT_READY",
    channel: "SMS",
    name: "Lab Report Ready - SMS",
    body: "Hi {{patientName}}, your lab report is ready. Please check your patient portal or contact reception. - {{hospitalName}}",
    variables: ["patientName", "hospitalName"],
  },

  // PAYMENT_RECEIVED
  {
    eventType: "PAYMENT_RECEIVED",
    channel: "WHATSAPP",
    name: "Payment Received - WhatsApp",
    body: "Hi {{patientName}}, payment of ₹{{amount}} received. Receipt: {{billNumber}}. Thank you. - {{hospitalName}}",
    variables: ["patientName", "amount", "billNumber", "hospitalName"],
  },
  {
    eventType: "PAYMENT_RECEIVED",
    channel: "SMS",
    name: "Payment Received - SMS",
    body: "Hi {{patientName}}, payment of ₹{{amount}} received. Receipt: {{billNumber}}. Thank you. - {{hospitalName}}",
    variables: ["patientName", "amount", "billNumber", "hospitalName"],
  },

  // APPOINTMENT_CANCELLED
  {
    eventType: "APPOINTMENT_CANCELLED",
    channel: "WHATSAPP",
    name: "Appointment Cancelled - WhatsApp",
    body: "Hi {{patientName}}, your appointment scheduled on {{appointmentDate}} at {{appointmentTime}} has been cancelled. - {{hospitalName}}",
    variables: ["patientName", "appointmentDate", "appointmentTime", "hospitalName"],
  },
  {
    eventType: "APPOINTMENT_CANCELLED",
    channel: "SMS",
    name: "Appointment Cancelled - SMS",
    body: "Hi {{patientName}}, your appointment scheduled on {{appointmentDate}} at {{appointmentTime}} has been cancelled. - {{hospitalName}}",
    variables: ["patientName", "appointmentDate", "appointmentTime", "hospitalName"],
  },

  // PHARMACY_SALE_COMPLETED
  {
    eventType: "PHARMACY_SALE_COMPLETED",
    channel: "WHATSAPP",
    name: "Pharmacy Sale Completed - WhatsApp",
    body: "Hi {{patientName}}, your pharmacy sale is completed. Please check your patient portal for details. - {{hospitalName}}",
    variables: ["patientName", "hospitalName"],
  },
  {
    eventType: "PHARMACY_SALE_COMPLETED",
    channel: "SMS",
    name: "Pharmacy Sale Completed - SMS",
    body: "Hi {{patientName}}, your pharmacy sale is completed. Please check your patient portal for details. - {{hospitalName}}",
    variables: ["patientName", "hospitalName"],
  },

  // FOLLOW_UP_REMINDER
  {
    eventType: "FOLLOW_UP_REMINDER",
    channel: "WHATSAPP",
    name: "Follow-Up Reminder - WhatsApp",
    body: "Hi {{patientName}}, this is a reminder for your follow-up with Dr. {{doctorName}} on {{appointmentDate}}. - {{hospitalName}}",
    variables: ["patientName", "doctorName", "appointmentDate", "hospitalName"],
  },
  {
    eventType: "FOLLOW_UP_REMINDER",
    channel: "SMS",
    name: "Follow-Up Reminder - SMS",
    body: "Hi {{patientName}}, this is a reminder for your follow-up with Dr. {{doctorName}} on {{appointmentDate}}. - {{hospitalName}}",
    variables: ["patientName", "doctorName", "appointmentDate", "hospitalName"],
  },
];

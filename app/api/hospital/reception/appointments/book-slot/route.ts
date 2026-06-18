import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { generateAppointmentId, generateTokenNumber } from "@/lib/hospital-clinical";
import { requireHospitalPermission } from "@/lib/hospital-auth";
import { sendEventNotification } from "@/lib/notifications/notification-service";
import Appointment, { type AppointmentStatus } from "@/models/Appointment";
import AppointmentSlot from "@/models/AppointmentSlot";
import HospitalUser from "@/models/HospitalUser";
import Patient from "@/models/Patient";

const bookSlotSchema = z.object({
  patientId: z.string().min(1),
  slotId: z.string().min(1),
  reason: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireHospitalPermission(req, "receptionist_slot_booking_create");
    const hospitalId = session.payload.hospitalId;
    const body = bookSlotSchema.parse(await req.json());
    await connectDb();

    // Validate patient belongs to same hospital
    const patient = await Patient.findOne({
      hospitalId,
      patientId: body.patientId,
      status: "Active",
    });
    if (!patient) return errorResponse("Patient not found for this hospital", 404);

    // Verify slot belongs to same hospital and is available
    const slot = await AppointmentSlot.findOne({
      hospitalId,
      slotId: body.slotId,
      status: "Available",
    });
    if (!slot) return errorResponse("Slot is not available", 409);

    // Slot date/time must not be in the past
    const slotDateTime = new Date(`${slot.date}T${slot.startTime}:00`);
    if (slotDateTime < new Date()) {
      return errorResponse("Cannot book a past slot", 409);
    }

    // Prevent duplicate active booking for same patient + doctor + date
    const activeStatuses: AppointmentStatus[] = ["Scheduled", "Checked In", "In Consultation"];
    const existingBooking = await Appointment.findOne({
      hospitalId,
      patientId: body.patientId,
      doctorUserId: slot.doctorUserId,
      appointmentDate: {
        $gte: new Date(`${slot.date}T00:00:00`),
        $lte: new Date(`${slot.date}T23:59:59`),
      },
      status: { $in: activeStatuses },
    });

    if (existingBooking) {
      return errorResponse(
        "Patient already has an active appointment with this doctor on this date",
        409,
        { existingAppointmentId: existingBooking.appointmentId },
      );
    }

    const appointmentDate = new Date(slot.date);
    const [appointmentId, tokenNumber] = await Promise.all([
      generateAppointmentId(hospitalId, appointmentDate),
      generateTokenNumber(hospitalId, appointmentDate),
    ]);

    // Atomic reserve
    const reserved = await AppointmentSlot.findOneAndUpdate(
      {
        hospitalId,
        slotId: body.slotId,
        status: "Available",
        $expr: { $lt: ["$bookedCount", "$maxBookings"] },
      },
      {
        $inc: { bookedCount: 1 },
        $push: { appointmentIds: appointmentId },
        updatedBy: session.payload.userId,
      },
      { new: true },
    );

    if (!reserved) {
      return errorResponse("This slot is no longer available", 409);
    }

    if (reserved.bookedCount >= reserved.maxBookings) {
      await AppointmentSlot.updateOne({ hospitalId, slotId: body.slotId }, { $set: { status: "Booked" } });
    }

    const appointment = await Appointment.create({
      hospitalId,
      appointmentId,
      patientId: body.patientId,
      doctorUserId: slot.doctorUserId,
      doctorProfileId: slot.doctorProfileId ?? "",
      departmentId: slot.departmentId ?? "",
      slotId: slot.slotId,
      availabilityId: slot.availabilityId,
      appointmentDate,
      appointmentTime: slot.startTime,
      scheduledStartTime: slot.startTime,
      scheduledEndTime: slot.endTime,
      estimatedConsultationMinutes: slot.durationMinutes,
      tokenNumber,
      type: "OPD",
      status: "Scheduled",
      source: "Reception Slot",
      reason: body.reason,
      notes: body.notes ?? "",
      createdBy: session.payload.userId,
    });

    // Fire-and-forget notification
    try {
      if (patient.phone) {
        const doctor = await HospitalUser.findOne({ _id: slot.doctorUserId, hospitalId }).select("name");
        void sendEventNotification({
          hospitalId,
          eventType: "APPOINTMENT_BOOKED",
          recipient: {
            type: "PATIENT",
            name: patient.name,
            phone: patient.phone,
            patientId: body.patientId,
          },
          context: {
            patientName: patient.name,
            doctorName: doctor?.name ?? "",
            hospitalName: session.hospital.name,
            appointmentDate: slot.date,
            appointmentTime: slot.startTime,
            tokenNumber,
          },
          relatedIds: { appointmentId },
        }).catch(() => {});
      }
    } catch {}

    return successResponse(
      serializeDoc({
        appointment,
        slot: {
          slotId: reserved.slotId,
          date: reserved.date,
          startTime: reserved.startTime,
          endTime: reserved.endTime,
          durationMinutes: reserved.durationMinutes,
          availableSeats: reserved.maxBookings - reserved.bookedCount,
        },
      }),
      "Slot booked for patient successfully",
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

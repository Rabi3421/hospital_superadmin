import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { generateAppointmentId, generateTokenNumber } from "@/lib/hospital-clinical";
import { requirePatientAuth } from "@/lib/hospital-patient";
import { sendEventNotification } from "@/lib/notifications/notification-service";
import Appointment, { type AppointmentStatus } from "@/models/Appointment";
import AppointmentSlot from "@/models/AppointmentSlot";
import HospitalUser from "@/models/HospitalUser";

const bookSlotSchema = z.object({
  slotId: z.string().min(1),
  reason: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requirePatientAuth(req);
    const hospitalId = session.payload.hospitalId;
    const patientId = session.patient.patientId;
    const body = bookSlotSchema.parse(await req.json());
    await connectDb();

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

    // Prevent duplicate active booking: same patient + same doctor + same date
    const activeStatuses: AppointmentStatus[] = ["Scheduled", "Checked In", "In Consultation"];
    const existingBooking = await Appointment.findOne({
      hospitalId,
      patientId,
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

    // Atomic reserve: increment bookedCount only if slot is still Available and has capacity
    const appointmentDate = new Date(slot.date);
    const [appointmentId, tokenNumber] = await Promise.all([
      generateAppointmentId(hospitalId, appointmentDate),
      generateTokenNumber(hospitalId, appointmentDate),
    ]);

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

    // Mark slot as Booked if full
    if (reserved.bookedCount >= reserved.maxBookings) {
      await AppointmentSlot.updateOne({ hospitalId, slotId: body.slotId }, { $set: { status: "Booked" } });
    }

    // Create the appointment
    const appointment = await Appointment.create({
      hospitalId,
      appointmentId,
      patientId,
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
      source: "Patient Portal Slot",
      reason: body.reason,
      notes: body.notes ?? "",
      createdBy: session.payload.userId,
    });

    // Fire-and-forget notification
    try {
      const doctor = await HospitalUser.findOne({ _id: slot.doctorUserId, hospitalId }).select("name");
      void sendEventNotification({
        hospitalId,
        eventType: "APPOINTMENT_BOOKED",
        recipient: {
          type: "PATIENT",
          name: session.patient.name,
          phone: session.patient.phone ?? "",
          patientId,
        },
        context: {
          patientName: session.patient.name,
          doctorName: doctor?.name ?? "",
          hospitalName: session.hospital.name,
          appointmentDate: slot.date,
          appointmentTime: slot.startTime,
          tokenNumber,
        },
        relatedIds: { appointmentId },
      }).catch(() => {});
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
      "Slot booked successfully",
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

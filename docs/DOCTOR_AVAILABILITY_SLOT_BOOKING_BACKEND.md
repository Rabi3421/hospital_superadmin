# Doctor Availability, Slot Booking, Doctor Queue & Clinical Record Access

Phase 13 backend implementation for the Hospital SaaS superadmin.

---

## Business Flow

1. Owner/Admin/Receptionist creates a **DoctorAvailability** for a doctor on a date.
2. Staff calls **generate-slots** to auto-create **AppointmentSlot** records from the availability window (excluding break).
3. The **public website** reads `GET /public/doctor-availability` and `GET /public/doctor-slots?date=` with no auth — returns only safe public fields.
4. A **patient** logs in, views available slots, and calls `POST /patient/appointments/book-slot` to create a `Scheduled` appointment atomically.
5. A **receptionist** can book on behalf of a walk-in/phone patient via `POST /reception/appointments/book-slot`.
6. The **patient** tracks their position via `GET /patient/appointments/:id/queue-status`.
7. The **receptionist** checks-in the patient (existing check-in API), moving status to `Checked In`.
8. The **doctor** views their queue via `GET /doctor/queue`, starts consultation → `In Consultation`, completes → `Completed`.
9. After consultation, **issued prescriptions, published lab reports, bills, pharmacy sales** become visible in the patient portal.
10. Owner/Admin access full clinical timeline via `GET /records/patients/:patientId`.

---

## Role Access Matrix

| Action | OWNER | ADMIN | RECEPTIONIST | DOCTOR | PATIENT |
|---|---|---|---|---|---|
| Create availability | ✅ | ✅ | ✅ | ❌ | ❌ |
| View availability | ✅ | ✅ | ✅ | Own only | ❌ (public API) |
| Update availability | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cancel availability | ✅ | ✅ | ✅ | ❌ | ❌ |
| Generate slots | ✅ | ✅ | ✅ | ❌ | ❌ |
| View slots | ✅ | ✅ | ✅ | Own only | ❌ (public API) |
| Block/unblock slots | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cancel slots | ✅ | ✅ | ✅ | ❌ | ❌ |
| Book slot (patient) | ❌ | ❌ | ❌ | ❌ | ✅ (own) |
| Book slot (reception) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Patient queue status | ❌ | ❌ | ❌ | ❌ | ✅ (own) |
| Staff queue status | ✅ | ✅ | ✅ | Own only | ❌ |
| Doctor slot dashboard | ✅ | ✅ | ❌ | Own only | ❌ |
| Clinical records (all) | ✅ | ✅ | Limited | Assigned | ❌ |
| Patient records (own) | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Models

### DoctorAvailability (`models/DoctorAvailability.ts`)

| Field | Type | Notes |
|---|---|---|
| hospitalId | string | Required, indexed |
| availabilityId | string | Format: `AVL-YYYY-XXXX`, unique per hospital |
| doctorUserId | string | References HospitalUser (DOCTOR role) |
| doctorProfileId | string | Optional, references HospitalDoctorPublicProfile |
| departmentId | string | Optional, references HospitalDepartment |
| date | string | `YYYY-MM-DD` |
| startTime | string | `HH:mm` |
| endTime | string | `HH:mm`, must be > startTime |
| slotDurationMinutes | number | Default 30, min 1 |
| breakStartTime | string | Optional `HH:mm` |
| breakEndTime | string | Optional `HH:mm`, must be > breakStartTime and within start/end |
| maxPatientsPerSlot | number | Default 1, min 1 |
| location | string | Optional |
| room | string | Optional |
| status | enum | `Active` \| `Cancelled` \| `Completed` |
| notes | string | Optional |
| createdBy | string | userId |
| cancelledAt | Date | Optional |
| cancellationReason | string | Optional |

**Indexes:** `(hospitalId, availabilityId)` unique, `(hospitalId, doctorUserId, date)`, `(hospitalId, date)`, `(hospitalId, status)`

### AppointmentSlot (`models/AppointmentSlot.ts`)

| Field | Type | Notes |
|---|---|---|
| hospitalId | string | Required |
| slotId | string | Format: `SLT-YYYY-XXXX`, unique per hospital |
| availabilityId | string | Parent availability |
| doctorUserId | string | Doctor |
| doctorProfileId | string | Optional |
| departmentId | string | Optional |
| date | string | `YYYY-MM-DD` |
| startTime | string | `HH:mm` |
| endTime | string | `HH:mm` |
| durationMinutes | number | Slot length |
| maxBookings | number | Default 1 |
| bookedCount | number | Atomic increment on booking |
| status | enum | `Available` \| `Booked` \| `Blocked` \| `Cancelled` \| `Completed` |
| appointmentIds | string[] | Linked appointment IDs |

**Double-booking:** Uses `findOneAndUpdate` with `$expr: { $lt: ["$bookedCount", "$maxBookings"] }` — atomic, race-condition-safe.

**Indexes:** `(hospitalId, slotId)` unique, `(hospitalId, doctorUserId, date, startTime)` unique, `(hospitalId, date, status)`, `(hospitalId, availabilityId)`

### Appointment model additions

New optional fields added (backward-compatible):

| Field | Type | Notes |
|---|---|---|
| slotId | string | Linked slot |
| availabilityId | string | Linked availability |
| doctorProfileId | string | Public profile ref |
| scheduledStartTime | string | `HH:mm` |
| scheduledEndTime | string | `HH:mm` |
| estimatedConsultationMinutes | number | From slot duration |
| queueNumber | number | Optional sequential queue number |

New `source` values: `Patient Portal Slot`, `Reception Slot`, `Public Website` (backward-compatible).

---

## New Permissions

### Doctor Availability
- `doctor_availability_view` — view availability records
- `doctor_availability_create` — create new availability
- `doctor_availability_update` — edit availability
- `doctor_availability_cancel` — cancel availability

### Doctor Slots
- `doctor_slots_view` — view slots
- `doctor_slots_generate` — generate slots from availability
- `doctor_slots_update` — edit room/location/notes
- `doctor_slots_block` — block/unblock available slot
- `doctor_slots_cancel` — cancel unbooked slot

### Slot Booking
- `patient_slot_booking_view` — patient can view available slots
- `patient_slot_booking_create` — patient can book own slot
- `receptionist_slot_booking_create` — staff can book on behalf of patient

### Queue Tracking
- `appointment_queue_tracking_view` — staff queue dashboard
- `doctor_queue_tracking_view` — doctor queue
- `patient_queue_tracking_view` — patient queue status

### Clinical Records
- `clinical_records_view` — base permission
- `clinical_records_view_all` — all hospital records
- `clinical_records_view_own` — own records
- `clinical_records_view_assigned` — assigned patients
- `patient_records_view` — view patient records
- `patient_records_view_all` — all patients
- `patient_records_view_own` — own records only

---

## Staff Availability APIs

All use `hospitalId` from JWT. Doctor role restricted to read-only on own records.

### `GET /api/hospital/doctor-availability`

Filters: `doctorUserId`, `date`, `fromDate`, `toDate`, `status`, `page`, `limit`

Doctor role automatically scoped to own availability.

### `POST /api/hospital/doctor-availability`

Requires: `doctor_availability_create`. Doctors cannot create.

Validates:
- `endTime > startTime`
- break within start/end
- date not in past (> 1 day)
- no overlapping active availability for same doctor/date

### `GET /api/hospital/doctor-availability/:availabilityId`

Doctor scoped to own.

### `PATCH /api/hospital/doctor-availability/:availabilityId`

Safe fields only. Rejects time/duration changes if booked slots exist.

### `POST /api/hospital/doctor-availability/:availabilityId/cancel`

- Rejects if booked slots exist (returns 409 with count).
- Safe cancel: cancels availability and all unbooked `Available` slots.

### `POST /api/hospital/doctor-availability/:availabilityId/generate-slots`

- Parses start/end/duration/break windows.
- Skips slots overlapping the break.
- Idempotent: skips existing slots by `(hospitalId, doctorUserId, date, startTime)` unique index.
- Returns `{ created, existing, skipped, total }`.

---

## Staff Slot APIs

### `GET /api/hospital/doctor-slots`

Filters: `doctorUserId`, `date`, `fromDate`, `toDate`, `status`, `availabilityId`, `departmentId`, `doctorProfileId`, `page`, `limit`

Enriched with compact doctor, department, and availability data.

### `GET /api/hospital/doctor-slots/:slotId`

Returns slot with booked appointment + patient summaries.

### `PATCH /api/hospital/doctor-slots/:slotId`

Editable fields: `room`, `location`, `notes` only.

### `POST /api/hospital/doctor-slots/:slotId/block`

Only for `Available` slots with `bookedCount = 0`.

### `POST /api/hospital/doctor-slots/:slotId/unblock`

Only for `Blocked` slots.

### `POST /api/hospital/doctor-slots/:slotId/cancel`

Only if `bookedCount = 0`. Returns 409 if booked.

---

## Public APIs

No auth required. Uses `x-hospital-id` header. Blocked for `Suspended`/`Cancelled` hospitals.

### `GET /api/hospital/public/doctor-availability`

Filters: `date`, `fromDate`, `toDate`, `doctorProfileId`, `departmentId`

Returns: availabilityId, date, times, break, room, location, doctor (name, specialization, consultationFee, photoUrl), department

### `GET /api/hospital/public/doctor-slots?date=YYYY-MM-DD`

`date` is required.

Returns only `Available` slots where `bookedCount < maxBookings`.

Returns: slotId, date, startTime, endTime, durationMinutes, availableSeats, room, location, status, doctor, department

Does **not** expose: doctorUserId, bookedCount, appointmentIds, internal fields.

---

## Patient Slot Booking

### `POST /api/hospital/patient/appointments/book-slot`

Auth: PATIENT only (via `hsa_hospital_token`).

Body:
```json
{
  "slotId": "SLT-2026-0001",
  "reason": "Fever and headache",
  "notes": "optional"
}
```

- hospitalId from JWT only.
- patientId from HospitalUser.patientId only (never body).
- Validates slot belongs to same hospital and is `Available`.
- Validates slot date/time not in past.
- Checks duplicate: same patient + same doctor + same date with active status → 409.
- Atomic `findOneAndUpdate` with `$expr: { $lt: ["$bookedCount", "$maxBookings"] }`.
- If atomic update fails → 409 "This slot is no longer available."
- Creates Appointment with `source: "Patient Portal Slot"`, `status: "Scheduled"`.
- Marks slot `Booked` when full.

---

## Receptionist Slot Booking

### `POST /api/hospital/reception/appointments/book-slot`

Auth: RECEPTIONIST, HOSPITAL_ADMIN.

Body:
```json
{
  "patientId": "PAT-2026-0001",
  "slotId": "SLT-2026-0001",
  "reason": "Walk-in visit",
  "notes": "optional"
}
```

Same atomic booking logic. Creates Appointment with `source: "Reception Slot"`.

---

## Queue Tracking APIs

### `GET /api/hospital/patient/appointments/:appointmentId/queue-status`

Auth: PATIENT only. Own appointment only.

Returns:
```json
{
  "appointmentId": "APT-2026-0001",
  "tokenNumber": "OPD-001",
  "status": "Scheduled",
  "queue": {
    "totalScheduledBefore": 2,
    "totalCheckedInBefore": 1,
    "totalInConsultation": 1,
    "totalCompletedBefore": 3,
    "currentServingToken": "OPD-003",
    "myPosition": 4,
    "estimatedWaitMinutes": 90,
    "averageConsultationMinutes": 30
  }
}
```

Does **not** expose other patient names or details.

### `GET /api/hospital/appointments/queue-status?date=YYYY-MM-DD`

Auth: OWNER, ADMIN, RECEPTIONIST, DOCTOR.

Doctor scoped to own queue. Returns full queue list with compact patient details.

---

## Doctor Dashboard Updates

### `GET /api/hospital/doctor/today`

Added slot counts:
- `todaySlotsTotal` — total slots for the day
- `todaySlotsBooked` — slots with at least one booking
- `todaySlotsAvailable` — slots still accepting bookings
- `todaySlotsCompleted` — completed slots

### `GET /api/hospital/doctor/queue`

Now sorted by `scheduledStartTime, tokenNumber`. Enriched with:
- `slot` — linked slot summary (startTime, endTime, status)
- `consultation` — linked consultation id and status
- `scheduledStartTime`, `scheduledEndTime`, `slotId`, `availabilityId`

### `GET /api/hospital/doctor/slots`

New endpoint for doctor slot dashboard.

Filters: `date`, `status`.

Doctor-scoped automatically. Enriched with booked patient appointment summaries.

---

## Owner/Admin Record Access

### `GET /api/hospital/records/patients`

Auth: OWNER, ADMIN, DOCTOR. Patient role forbidden.

Filters: `q` (search by name/patientId/phone/email), `page`, `limit`.

Returns patient list with `appointmentCount` summary.

### `GET /api/hospital/records/patients/:patientId`

Auth: OWNER, ADMIN, DOCTOR. Patient role forbidden.

Returns complete hospital-internal clinical timeline:
- patient profile
- appointments (doctor scoped for DOCTOR role)
- consultations (doctor scoped for DOCTOR role)
- prescriptions (doctor scoped for DOCTOR role)
- labOrders
- labReports (published only)
- bills
- pharmacySales

No cross-hospital access possible — hospitalId always from JWT.

---

## Patient Record Visibility

The existing patient portal APIs already enforce visibility:
- `patient_prescriptions_view` → `status: "Issued"` prescriptions only
- `patient_lab_reports_view` → `status: "Published"` lab reports only
- `patient_bills_view` → own bills only
- `patient_pharmacy_sales_view` → own pharmacy sales only

Draft prescriptions, draft lab reports, and internal admin fields are never returned to the patient role.

---

## Appointment Status Transitions

```
Scheduled → Checked In (receptionist check-in)
Checked In → In Consultation (doctor start consultation)
Scheduled → In Consultation (direct, if allowed)
In Consultation → Completed (doctor complete consultation)
Any active → Cancelled
Any → No Show
```

Queue automatically updates from status changes. Cancelled/No Show excluded from active queue position calculations.

---

## Double-Booking Prevention

Two layers:

1. **Duplicate appointment check:** Before atomic slot reservation, query for existing active appointment (`Scheduled`, `Checked In`, `In Consultation`) for same patient + doctor + date → 409.

2. **Atomic slot reservation:** `findOneAndUpdate` with condition `$expr: { $lt: ["$bookedCount", "$maxBookings"] }` on `status: "Available"` — if the update matches 0 documents (slot just got booked by someone else), returns 409 "This slot is no longer available."

The unique index on `(hospitalId, doctorUserId, date, startTime)` also prevents duplicate slot creation.

---

## Tenant Isolation

- Public APIs use `x-hospital-id` header only (via `requireValidHospital`).
- Authenticated APIs use `hospitalId` from JWT only (via `requireHospitalAuth`).
- Patient APIs derive `patientId` from `HospitalUser.patientId` — never from request body.
- All DB queries include `hospitalId` filter.
- DOCTOR role restricted to own doctorUserId in all queries.
- No cross-hospital lookups.
- `passwordHash` never returned in any response.

---

## Error Reference

| Status | Message |
|---|---|
| 401 | Unauthorized hospital session |
| 403 | Forbidden: role not allowed / hospital blocked |
| 404 | Doctor availability not found / Slot not found / Patient not found |
| 409 | This slot is no longer available |
| 409 | Patient already has an active appointment with this doctor on this date |
| 409 | Cannot cancel availability with N booked slot(s) |
| 409 | Cannot block a slot that has bookings |
| 409 | Doctor availability overlaps existing availability for this date |
| 422 | Validation failed / date is required |
| 500 | Internal server error (safe message) |

---

## Known Limitations

- **Token number generation** (`OPD-XXX`) uses sequential query — low-volume race condition possible. For high-concurrency, consider an atomic counter collection.
- **Slot ID generation** (`SLT-YYYY-XXXX`) uses sequential query — idempotent generate-slots uses per-window existence check, safe for typical usage.
- Availability overlap check uses `$lt`/`$gt` on string time — works correctly for `HH:mm` format within the same date, but does not validate across midnight spans (avoid multi-day availability).
- Public slot API does not do real-time seat pre-reservation — concurrent booking is handled at write time by the atomic update.

---

## Curl Examples

### A. Create Doctor Availability (Owner/Admin/Receptionist)
```bash
curl -X POST https://your-domain/api/hospital/doctor-availability \
  -H "Content-Type: application/json" \
  -b "hsa_hospital_token=YOUR_TOKEN" \
  -d '{
    "doctorUserId": "64abc123...",
    "departmentId": "64def456...",
    "date": "2026-06-20",
    "startTime": "09:00",
    "endTime": "13:00",
    "slotDurationMinutes": 30,
    "breakStartTime": "11:00",
    "breakEndTime": "11:30",
    "room": "OPD-1",
    "notes": "Morning OPD"
  }'
```

### B. Generate Slots from Availability
```bash
curl -X POST https://your-domain/api/hospital/doctor-availability/AVL-2026-0001/generate-slots \
  -b "hsa_hospital_token=YOUR_TOKEN"
```

### C. Public: List Available Slots for a Date
```bash
curl https://your-domain/api/hospital/public/doctor-slots?date=2026-06-20 \
  -H "x-hospital-id: HOSP-001"
```

### D. Patient Login
```bash
curl -X POST https://your-domain/api/hospital/auth/login \
  -H "Content-Type: application/json" \
  -H "x-hospital-id: HOSP-001" \
  -d '{"identifier": "patient@email.com", "password": "pass123"}'
```

### E. Patient Books a Slot
```bash
curl -X POST https://your-domain/api/hospital/patient/appointments/book-slot \
  -H "Content-Type: application/json" \
  -b "hsa_hospital_token=PATIENT_TOKEN" \
  -d '{
    "slotId": "SLT-2026-0003",
    "reason": "Fever and headache"
  }'
```

### F. Duplicate Booking Returns 409
```bash
# Same request again returns:
# { "success": false, "message": "Patient already has an active appointment with this doctor on this date" }
```

### G. Patient Gets Queue Status
```bash
curl https://your-domain/api/hospital/patient/appointments/APT-2026-0001/queue-status \
  -b "hsa_hospital_token=PATIENT_TOKEN"
```

### H. Receptionist Books Slot for Existing Patient
```bash
curl -X POST https://your-domain/api/hospital/reception/appointments/book-slot \
  -H "Content-Type: application/json" \
  -b "hsa_hospital_token=RECEPTIONIST_TOKEN" \
  -d '{
    "patientId": "PAT-2026-0012",
    "slotId": "SLT-2026-0005",
    "reason": "Walk-in visit"
  }'
```

### I. Receptionist Today Queue (includes slot/token/position)
```bash
curl https://your-domain/api/hospital/reception/today-queue \
  -b "hsa_hospital_token=RECEPTIONIST_TOKEN"
```

### J. Doctor Dashboard Queue
```bash
curl https://your-domain/api/hospital/doctor/queue \
  -b "hsa_hospital_token=DOCTOR_TOKEN"
```

### K. Doctor Starts Consultation
```bash
curl -X POST https://your-domain/api/hospital/appointments/APT-2026-0001/start-consultation \
  -b "hsa_hospital_token=DOCTOR_TOKEN"
```

### L. Doctor Completes Consultation
```bash
curl -X POST https://your-domain/api/hospital/appointments/APT-2026-0001/complete \
  -b "hsa_hospital_token=DOCTOR_TOKEN"
```

### M. Doctor Creates Prescription
```bash
curl -X POST https://your-domain/api/hospital/prescriptions \
  -H "Content-Type: application/json" \
  -b "hsa_hospital_token=DOCTOR_TOKEN" \
  -d '{
    "consultationId": "CON-2026-0001",
    "appointmentId": "APT-2026-0001",
    "patientId": "PAT-2026-0001",
    "medicines": [{ "medicineName": "Paracetamol", "dosage": "500mg", "frequency": "TDS", "duration": "3 days" }]
  }'
```

### N. Patient Views Issued Prescription
```bash
curl https://your-domain/api/hospital/patient/prescriptions \
  -b "hsa_hospital_token=PATIENT_TOKEN"
```

### O. Owner/Admin Views Patient Clinical Record
```bash
curl https://your-domain/api/hospital/records/patients/PAT-2026-0001 \
  -b "hsa_hospital_token=OWNER_TOKEN"
```

import { z } from "zod";

export const noticeCreateSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(3),
  type: z.enum(["General", "Emergency", "Holiday", "Announcement"]).optional().default("General"),
  status: z.enum(["Published", "Draft"]).optional().default("Draft"),
});
export const noticeUpdateSchema = noticeCreateSchema.partial();

export const galleryCreateSchema = z.object({
  title: z.string().min(2),
  imageUrl: z.string().url(),
  category: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
  sortOrder: z.coerce.number().optional().default(0),
});
export const galleryUpdateSchema = galleryCreateSchema.partial();

export const contactEnquiryUpdateSchema = z.object({
  status: z.enum(["New", "Read", "Replied", "Closed"]).optional(),
  notes: z.string().optional(),
});

export const appointmentRequestUpdateSchema = z.object({
  status: z.enum(["New", "Confirmed", "Cancelled", "Completed"]).optional(),
  notes: z.string().optional(),
});

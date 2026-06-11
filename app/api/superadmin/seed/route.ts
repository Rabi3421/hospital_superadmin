import bcrypt from "bcryptjs";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import SuperAdmin from "@/models/SuperAdmin";

const seedSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export async function POST(req: Request) {
  try {
    await connectDb();
    const existing = await SuperAdmin.countDocuments();
    if (existing > 0) {
      return errorResponse("Superadmin already exists", 409);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = seedSchema.parse(body);
    const name = parsed.name ?? process.env.SUPERADMIN_NAME;
    const email = parsed.email ?? process.env.SUPERADMIN_EMAIL;
    const password = parsed.password ?? process.env.SUPERADMIN_PASSWORD;

    if (!name || !email || !password) {
      return errorResponse("SUPERADMIN_NAME, SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required", 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await SuperAdmin.create({
      name,
      email,
      passwordHash,
      role: "SUPERADMIN",
      status: "Active",
    });

    const safeAdmin = await SuperAdmin.findById(admin._id).select("-passwordHash");
    return successResponse(serializeDoc(safeAdmin), "Superadmin created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

import bcrypt from "bcryptjs";
import { z } from "zod";
import { errorResponse, handleApiError, serializeDoc, successResponse } from "@/lib/api-response";
import { connectDb } from "@/lib/db";
import { setSuperAdminCookie, signSuperAdminToken } from "@/lib/superadmin-auth";
import SuperAdmin from "@/models/SuperAdmin";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    await connectDb();
    const admin = await SuperAdmin.findOne({ email: body.email.toLowerCase() });
    if (!admin) {
      return errorResponse("Invalid email or password", 401);
    }

    const passwordMatches = await bcrypt.compare(body.password, admin.passwordHash);
    if (!passwordMatches) {
      return errorResponse("Invalid email or password", 401);
    }

    if (admin.status === "Blocked") {
      return errorResponse("Superadmin account is blocked", 403);
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const safeAdmin = await SuperAdmin.findById(admin._id).select("-passwordHash");
    const response = successResponse(serializeDoc(safeAdmin), "Logged in");
    setSuperAdminCookie(response, signSuperAdminToken(admin));
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

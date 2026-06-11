import { NextRequest, NextResponse } from "next/server";
import { corsResponse, withCors } from "@/lib/cors";

export function proxy(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  return withCors(req, NextResponse.next());
}

export const config = {
  matcher: "/api/:path*",
};

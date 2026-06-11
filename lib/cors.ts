import { NextResponse } from "next/server";

const defaultAllowedOrigins = [
  "http://localhost:4028",
  "http://localhost:3001",
  "http://localhost:3000",
];

function normalizeOrigin(value: string) {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

function getAllowedOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(",") ?? []),
  ].filter((origin): origin is string => Boolean(origin?.trim()));

  return new Set([...defaultAllowedOrigins, ...configuredOrigins].map(normalizeOrigin));
}

export function getCorsHeaders(req: Request) {
  const headers = new Headers({
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-hospital-id",
    Vary: "Origin",
  });
  const origin = req.headers.get("origin");

  if (origin && getAllowedOrigins().has(normalizeOrigin(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

export function withCors<T extends Response>(req: Request, response: T): T {
  getCorsHeaders(req).forEach((value, key) => {
    if (key.toLowerCase() === "vary") {
      const existingVary = response.headers.get("Vary");
      const values = new Set(
        `${existingVary ?? ""},${value}`
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      response.headers.set("Vary", [...values].join(", "));
      return;
    }

    response.headers.set(key, value);
  });

  return response;
}

export function corsResponse(req: Request) {
  return withCors(req, new NextResponse(null, { status: 204 }));
}

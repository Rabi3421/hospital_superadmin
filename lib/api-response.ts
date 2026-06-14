import { NextResponse } from "next/server";
import { ZodError } from "zod";

type ApiMeta = Record<string, unknown>;

export function successResponse<T>(
  data: T,
  message = "Success",
  status = 200,
  meta?: ApiMeta,
) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    },
    { status },
  );
}

export function errorResponse(
  message = "Something went wrong",
  status = 500,
  errors?: unknown,
) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(errors ? { errors } : {}),
    },
    { status },
  );
}

export function validationErrorResponse(error: ZodError) {
  return errorResponse("Validation failed", 422, error.flatten());
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return validationErrorResponse(error);
  }

  if (error instanceof Error) {
    if ("code" in error && error.code === 11000) {
      return errorResponse("Duplicate value already exists", 409);
    }

    if (error.message.startsWith("Unauthorized")) {
      return errorResponse(error.message, 401);
    }

    if (error.message.startsWith("Forbidden")) {
      return errorResponse(error.message, 403);
    }

    if (error.message === "Hospital is suspended" || error.message === "Hospital is cancelled") {
      return errorResponse(error.message, 403);
    }

    if (error.message === "Hospital trial has expired") {
      return errorResponse(error.message, 403);
    }

    if (error.message === "Hospital not found") {
      return errorResponse(error.message, 404);
    }

    if (error.message === "Hospital ID is required") {
      return errorResponse(error.message, 400);
    }

    if (error.message.startsWith("Cannot move appointment")) {
      return errorResponse(error.message, 409);
    }

    if (error.message.startsWith("Subscription limit reached")) {
      return errorResponse(error.message, 409);
    }

    if (error.message.includes("not found for this hospital")) {
      return errorResponse(error.message, 404);
    }

    return errorResponse(error.message, 500);
  }

  return errorResponse();
}

export function serializeDoc<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}

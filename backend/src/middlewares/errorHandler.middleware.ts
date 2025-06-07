import { ErrorRequestHandler, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { AppError } from "../utils/appError";
import { z, ZodError } from "zod";
import { ErrorCodeEnum } from "../enums/error-code.enum";

const formatZodError = (res: Response, error: z.ZodError) => {
  const errors = error?.issues?.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
  res.status(HTTPSTATUS.BAD_REQUEST).json({
    message: "Validation failed",
    errors: errors,
    errorCode: ErrorCodeEnum.VALIDATION_ERROR,
  });
};

export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  _next
): void => {
  console.error(`Error Occured on PATH: ${req.path}`, {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
  });

  // Handle BadRequestException
  if (error.name === "BadRequestException") {
    res.status(error.statusCode || HTTPSTATUS.BAD_REQUEST).json({
      message: error.message,
      errorCode: error.errorCode || ErrorCodeEnum.AUTH_INVALID_TOKEN,
    });
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "Invalid JSON format. Please check your request body.",
    });
    return;
  }

  if (error instanceof ZodError) {
    formatZodError(res, error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      errorCode: error.errorCode,
    });
    return;
  }

  res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
    message: "Internal Server Error",
    error: error?.message || "Unknown error occurred",
    errorCode: ErrorCodeEnum.INTERNAL_SERVER_ERROR,
  });
};

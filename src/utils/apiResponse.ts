const successResponse = (
  res,
  message = "Action completed successfully",
  data?: unknown,
  statusCode = 200,
  pagination?: unknown
) => {
  const payload: {
    success: boolean;
    message: string;
    data?: unknown;
    pagination?: unknown;
    requestId?: string;
  } = {
    success: true,
    message
  };

  if (data !== undefined) {
    payload.data = data;
  }

  if (pagination !== undefined) {
    payload.pagination = pagination;
  }

  if (typeof res.locals?.requestId === "string") {
    payload.requestId = res.locals.requestId;
  }

  return res.status(statusCode).json(payload);
};

const errorResponse = (
  res,
  message = "Internal server error",
  statusCode = 500,
  errors = [],
  code?: string
) => {
  const payload: {
    success: boolean;
    message: string;
    errors: unknown[];
    code?: string;
    requestId?: string;
  } = {
    success: false,
    message,
    errors
  };

  if (code) {
    payload.code = code;
  }

  if (typeof res.locals?.requestId === "string") {
    payload.requestId = res.locals.requestId;
  }

  return res.status(statusCode).json(payload);
};

export {
  successResponse,
  errorResponse
};

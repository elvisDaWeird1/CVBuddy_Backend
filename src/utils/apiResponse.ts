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

  return res.status(statusCode).json(payload);
};

const errorResponse = (
  res,
  message = "Internal server error",
  statusCode = 500,
  errors = []
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

export {
  successResponse,
  errorResponse
};

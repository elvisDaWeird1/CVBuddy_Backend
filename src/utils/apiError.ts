class ApiError extends Error {
  statusCode: number;
  errors: unknown[];
  code?: string;

  constructor(statusCode, message, errors = [], code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
  }
}

export default ApiError;

class ApiError extends Error {
  statusCode: number;
  errors: unknown[];

  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export default ApiError;

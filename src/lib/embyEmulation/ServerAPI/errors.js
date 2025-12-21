// Express error handling utility to replace restify-errors
// This provides a similar API to restify-errors for backward compatibility

/**
 * Creates an error with the specified status code and message
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {Error} Error object with statusCode property
 */
function createError(statusCode, message) {
    const error = new Error(message);

    error.statusCode = statusCode;
    return error;
}

// Common HTTP errors
const errors = {
    BadRequestError: (message = 'Bad Request') => createError(400, message),
    UnauthorizedError: (message = 'Unauthorized') => createError(401, message),
    ForbiddenError: (message = 'Forbidden') => createError(403, message),
    NotFoundError: (message = 'Not Found') => createError(404, message),
    MethodNotAllowedError: (message = 'Method Not Allowed') => createError(405, message),
    NotAcceptableError: (message = 'Not Acceptable') => createError(406, message),
    ConflictError: (message = 'Conflict') => createError(409, message),
    GoneError: (message = 'Gone') => createError(410, message),
    UnsupportedMediaTypeError: (message = 'Unsupported Media Type') => createError(415, message),
    UnprocessableEntityError: (message = 'Unprocessable Entity') => createError(422, message),
    InternalServerError: (message = 'Internal Server Error') => createError(500, message),
    NotImplementedError: (message = 'Not Implemented') => createError(501, message),
    BadGatewayError: (message = 'Bad Gateway') => createError(502, message),
    ServiceUnavailableError: (message = 'Service Unavailable') => createError(503, message),
    GatewayTimeoutError: (message = 'Gateway Timeout') => createError(504, message),

    // Additional errors used in the codebase
    InvalidCredentialsError: (message = 'Invalid Credentials') => createError(401, message),
    InvalidArgumentError: (message = 'Invalid Argument') => createError(400, message),
    MissingParameterError: (message = 'Missing Parameter') => createError(400, message),
};

export default errors;

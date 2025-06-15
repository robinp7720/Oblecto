// Express error handling utility to replace restify-errors
// This provides a similar API to restify-errors for backward compatibility

// Base HTTP Error class
class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Common HTTP errors
const errors = {
    BadRequestError: class extends HttpError {
        constructor(message = 'Bad Request') {
            super(400, message);
        }
    },
    UnauthorizedError: class extends HttpError {
        constructor(message = 'Unauthorized') {
            super(401, message);
        }
    },
    ForbiddenError: class extends HttpError {
        constructor(message = 'Forbidden') {
            super(403, message);
        }
    },
    NotFoundError: class extends HttpError {
        constructor(message = 'Not Found') {
            super(404, message);
        }
    },
    MethodNotAllowedError: class extends HttpError {
        constructor(message = 'Method Not Allowed') {
            super(405, message);
        }
    },
    NotAcceptableError: class extends HttpError {
        constructor(message = 'Not Acceptable') {
            super(406, message);
        }
    },
    ConflictError: class extends HttpError {
        constructor(message = 'Conflict') {
            super(409, message);
        }
    },
    GoneError: class extends HttpError {
        constructor(message = 'Gone') {
            super(410, message);
        }
    },
    UnsupportedMediaTypeError: class extends HttpError {
        constructor(message = 'Unsupported Media Type') {
            super(415, message);
        }
    },
    UnprocessableEntityError: class extends HttpError {
        constructor(message = 'Unprocessable Entity') {
            super(422, message);
        }
    },
    InternalServerError: class extends HttpError {
        constructor(message = 'Internal Server Error') {
            super(500, message);
        }
    },
    NotImplementedError: class extends HttpError {
        constructor(message = 'Not Implemented') {
            super(501, message);
        }
    },
    BadGatewayError: class extends HttpError {
        constructor(message = 'Bad Gateway') {
            super(502, message);
        }
    },
    ServiceUnavailableError: class extends HttpError {
        constructor(message = 'Service Unavailable') {
            super(503, message);
        }
    },
    GatewayTimeoutError: class extends HttpError {
        constructor(message = 'Gateway Timeout') {
            super(504, message);
        }
    },

    // Additional errors used in the codebase
    InvalidCredentialsError: class extends HttpError {
        constructor(message = 'Invalid Credentials') {
            super(401, message);
        }
    },
    InvalidArgumentError: class extends HttpError {
        constructor(message = 'Invalid Argument') {
            super(400, message);
        }
    },
    MissingParameterError: class extends HttpError {
        constructor(message = 'Missing Parameter') {
            super(400, message);
        }
    }
};

export default errors;

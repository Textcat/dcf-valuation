export class HttpError extends Error {
    readonly status: number
    readonly code: string
    readonly details?: unknown

    constructor(status: number, code: string, message: string, details?: unknown) {
        super(message)
        this.status = status
        this.code = code
        this.details = details
    }
}

export interface ErrorBody {
    error: {
        code: string
        message: string
        requestId: string
        details?: unknown
    }
}

export function buildErrorBody(requestId: string, err: HttpError): ErrorBody {
    return {
        error: {
            code: err.code,
            message: err.message,
            requestId,
            details: err.details
        }
    }
}

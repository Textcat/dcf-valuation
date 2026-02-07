export type HttpErrorStatus = 400 | 401 | 404 | 422 | 500

export class HttpError extends Error {
    readonly status: HttpErrorStatus
    readonly code: string
    readonly details?: unknown

    constructor(status: HttpErrorStatus, code: string, message: string, details?: unknown) {
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

/** Error dengan status HTTP; ditangkap oleh middleware errorHandler. */
export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = "HttpError";
    }
}

import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/httpError';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof HttpError) {
        return res.status(err.status).json({ message: err.message });
    }

    console.error('Unhandled Error:', err);
    res.status(500).json({
        message: "Internal server error"
    });
};

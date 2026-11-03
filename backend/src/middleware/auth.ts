import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: "Akses ditolak. Token tidak ditemukan"
        });
    }

    const token = authHeader.split(' ')[1];

    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
        throw new Error("FATAL ERROR: JWT_SECRET belum diatur di file .env");
    }

    let decoded: jwt.JwtPayload & { userId?: string };
    try {
        decoded = jwt.verify(token, secretKey) as jwt.JwtPayload & { userId?: string };
    } catch {
        return res.status(401).json({ message: "Token tidak valid atau sudah kadaluwarsa." });
    }

    // Tanda tangan valid belum tentu usernya ada (akun dihapus, atau token dari database lain).
    const userExists = decoded.userId
        ? await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true } })
        : null;
    if (!userExists) {
        return res.status(401).json({ message: "Sesi tidak berlaku. Silakan login ulang." });
    }

    res.locals.user = decoded;
    next();
}
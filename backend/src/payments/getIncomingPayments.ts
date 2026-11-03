import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import z from "zod";
import { paymentInclude, serializePayment } from "./paymentService";

const router = Router();

router.get('/incoming', authenticate, async (req: Request, res: Response) => {
    const currentUserId = res.locals.user.userId;

    const incomingPayments = await prisma.payment.findMany({
        where: { toUser: currentUserId, status: 'pending' },
        include: paymentInclude,
        orderBy: { submittedAt: 'desc' },
    });

    return res.status(200).json(incomingPayments.map(serializePayment));
});

// GET /payments/:id — detail satu pengajuan (hanya pengirim / penerima)
router.get('/:id', authenticate, async (req: Request, res: Response) => {
    const currentUserId = res.locals.user.userId;
    const paymentId = req.params.id as string;
    if (!z.string().uuid().safeParse(paymentId).success) {
        return res.status(404).json({ message: "Pengajuan tidak ditemukan" });
    }

    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: paymentInclude,
    });

    if (!payment) return res.status(404).json({ message: "Pengajuan tidak ditemukan" });
    if (payment.fromUser !== currentUserId && payment.toUser !== currentUserId) {
        return res.status(403).json({ message: "Kamu tidak terlibat di pengajuan ini" });
    }

    return res.status(200).json(serializePayment(payment));
});

export { router as incomingPaymentsRouter };

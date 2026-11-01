import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { createNotification } from "../notifications/notificationService";
import { describeItems, rejectPayment } from "./paymentService";

const router = Router();

router.patch('/:id/reject', authenticate, async (req: Request, res: Response) => {
    const paymentId = req.params.id as string;
    const currentUserId = res.locals.user.userId;
    const rejectionNote = typeof req.body?.rejectionNote === 'string' && req.body.rejectionNote.trim()
        ? req.body.rejectionNote.trim()
        : null;

    const payment = await rejectPayment(paymentId, currentUserId, rejectionNote);

    await createNotification(
        payment.fromUser,
        'PAYMENT_REJECTED',
        `${payment.to.name} menolak pembayaranmu untuk ${describeItems(payment.items)}. Alasan: ${rejectionNote || 'Tidak ada alasan'}`,
        payment.id
    );

    return res.status(200).json({ message: "Pembayaran ditolak", payment });
});

export { router as rejectPaymentRouter };

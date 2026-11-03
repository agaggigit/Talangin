import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { createNotification } from "../notifications/notificationService";
import { approvePayment, describeItems } from "./paymentService";

const router = Router();

router.patch('/:id/approve', authenticate, async (req: Request, res: Response) => {
    const paymentId = req.params.id as string;
    const currentUserId = res.locals.user.userId;

    const payment = await approvePayment(paymentId, currentUserId);

    await createNotification(
        payment.fromUser,
        'PAYMENT_APPROVED',
        `${payment.to.name} telah menerima pembayaranmu untuk ${describeItems(payment.items)}.`,
        payment.id
    );

    return res.status(200).json({ message: "Pembayaran berhasil disetujui", payment });
});

export { router as approvePaymentRouter };

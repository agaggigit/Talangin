import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
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

export { router as incomingPaymentsRouter };

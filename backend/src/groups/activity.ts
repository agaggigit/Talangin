import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import { paymentInclude, serializePayment } from "../payments/paymentService";

const router = Router();

router.get('/:id/activity', authenticate, async (req: Request, res: Response) => {
    const groupId = req.params.id as string;
    const userId = res.locals.user.userId;

    const isMember = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } }
    });

    if (!isMember) {
        return res.status(403).json({ message: "Kamu bukan anggota grup ini" });
    }

    // Aktivitas pelunasan (tunggal maupun selisih) di grup ini
    const payments = await prisma.payment.findMany({
        where: { groupId },
        include: paymentInclude,
        orderBy: { submittedAt: 'desc' },
        take: 20
    });

    return res.status(200).json(payments.map(serializePayment));
});

export { router as getActivityRouter };

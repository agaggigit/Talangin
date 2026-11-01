import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import { computeBalances } from "./balance";

const router = Router();

router.get('/:id/balance', authenticate, async (req: Request, res: Response) => {
    const groupId = req.params.id as string;
    const currentUserId = res.locals.user.userId;

    // Validasi apakah user bagian dari grup
    const member = await prisma.groupMember.findUnique({
        where: {
            groupId_userId: {
                groupId: groupId,
                userId: currentUserId
            }
        }
    });

    if (!member) {
        return res.status(403).json({ message: "Kamu bukan anggota grup ini" });
    }

    // Ambil semua tagihan di grup ini yang memiliki share belum lunas
    const expenses = await prisma.expense.findMany({
        where: { groupId },
        include: {
            shares: {
                where: { isPaid: false },
                include: {
                    user: { select: { id: true, name: true } },
                    // alokasi aktif pada share yang belum lunas = pengajuan yang masih pending
                    allocations: { where: { active: true }, select: { id: true } }
                }
            },
            paidByUser: { select: { id: true, name: true } }
        }
    });

    const numberExpenses = expenses.map(exp => ({
        ...exp,
        shares: exp.shares.map(({ allocations, ...share }) => ({
            ...share,
            shareAmount: Number(share.shareAmount),
            pending: allocations.length > 0
        })),
    }));
    
    const debtSummary = computeBalances(numberExpenses, currentUserId);

    return res.status(200).json(debtSummary);

});

export { router as getGroupBalanceRouter };

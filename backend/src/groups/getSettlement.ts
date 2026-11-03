import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import { findOpenShares } from "../payments/paymentService";
import { planPairSettlement } from "../payments/settlement";
import { simplifyDebts } from "./simplifyDebts";

const router = Router();

async function assertMember(groupId: string, userId: string) {
    return prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
}

// GET /groups/:id/settle-preview?with=<userId>
// Pratinjau "lunasi selisih" dengan satu orang: berapa yang harus ditransfer & tagihan apa saja yang tertutup.
router.get('/:id/settle-preview', authenticate, async (req: Request, res: Response) => {
    const groupId = req.params.id as string;
    const currentUserId = res.locals.user.userId;
    const counterpartyId = req.query.with as string | undefined;

    if (!counterpartyId) return res.status(400).json({ message: "Parameter 'with' wajib diisi" });
    if (!(await assertMember(groupId, currentUserId))) {
        return res.status(403).json({ message: "Kamu bukan anggota grup ini" });
    }

    const counterparty = await prisma.user.findUnique({ where: { id: counterpartyId }, select: { id: true, name: true } });
    if (!counterparty) return res.status(404).json({ message: "User tidak ditemukan" });

    const openShares = await findOpenShares(groupId, [currentUserId, counterpartyId]);
    const plan = planPairSettlement(openShares, currentUserId, counterpartyId);

    // Ada share di antara kami yang sedang menunggu konfirmasi? (tidak ikut di plan)
    const pendingCount = await prisma.paymentAllocation.count({
        where: {
            active: true,
            payment: {
                status: 'pending',
                groupId,
                OR: [
                    { fromUser: currentUserId, toUser: counterpartyId },
                    { fromUser: counterpartyId, toUser: currentUserId },
                ],
            },
        },
    });

    return res.status(200).json({
        counterparty,
        plan: plan && {
            ...plan,
            // Dari sudut pandang user yang sedang login
            iPay: plan.fromUser === currentUserId && plan.amount > 0,
            theyPay: plan.toUser === currentUserId && plan.amount > 0,
        },
        pendingCount,
    });
});

// GET /groups/:id/settlement-plan
// Saran transfer minimal untuk melunasi SEMUA utang di grup (penyederhanaan utang).
router.get('/:id/settlement-plan', authenticate, async (req: Request, res: Response) => {
    const groupId = req.params.id as string;
    const currentUserId = res.locals.user.userId;

    if (!(await assertMember(groupId, currentUserId))) {
        return res.status(403).json({ message: "Kamu bukan anggota grup ini" });
    }

    const members = await prisma.groupMember.findMany({
        where: { groupId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const memberIds = members.map(m => m.userId);
    const users = new Map(members.map(m => [m.userId, m.user]));

    const openShares = await findOpenShares(groupId, memberIds);
    const directDebtCount = new Set(openShares.map(s => `${s.debtorId}->${s.creditorId}`)).size;

    const transfers = simplifyDebts(openShares).map(t => ({
        from: users.get(t.from) ?? { id: t.from, name: 'Mantan anggota', avatarUrl: null },
        to: users.get(t.to) ?? { id: t.to, name: 'Mantan anggota', avatarUrl: null },
        amount: t.amount,
    }));

    return res.status(200).json({
        transfers,
        // Berapa transfer yang dibutuhkan tanpa penyederhanaan (setiap pasangan pengutang->penalang)
        directTransferCount: directDebtCount,
    });
});

export { router as getSettlementRouter };

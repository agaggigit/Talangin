import { Router, Request, Response } from "express";
import z from "zod";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import { createNotification } from "../notifications/notificationService";
import { createPaymentWithAllocations, describeItems, findOpenShares } from "./paymentService";
import { planPairSettlement } from "./settlement";

const router = Router();

const singlePaymentSchema = z.object({
    expenseShareId: z.string().uuid("ID share tidak valid"),
    note: z.string().max(500).optional(),
});

// POST /payments — lunasi satu share penuh
router.post('/', authenticate, async (req: Request, res: Response) => {
    const parsed = singlePaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const { expenseShareId, note } = parsed.data;
    const currentUserId = res.locals.user.userId;

    const share = await prisma.expenseShare.findUnique({
        where: { id: expenseShareId },
        include: { expense: true },
    });

    if (!share) return res.status(404).json({ message: "Data utang tidak ditemukan" });
    if (share.userId !== currentUserId) return res.status(403).json({ message: "Ini bukan utangmu!" });
    if (share.isPaid) return res.status(400).json({ message: "Utang ini sudah lunas." });

    // Tidak perlu cek "sudah ada pengajuan pending?" di sini: partial unique index di DB
    // yang menjamin, termasuk saat dua request datang bersamaan (-> 409).
    const payment = await createPaymentWithAllocations({
        groupId: share.expense.groupId,
        fromUser: currentUserId,
        toUser: share.expense.paidBy,
        amount: Number(share.shareAmount),
        note: note || '',
        allocations: [{ shareId: share.id, amount: Number(share.shareAmount) }],
    });

    await createNotification(
        share.expense.paidBy,
        'PAYMENT_PENDING',
        `${payment.from.name} mengajukan pelunasan untuk ${describeItems(payment.items)}.`,
        payment.id
    );

    return res.status(201).json({ message: "Pengajuan pembayaran berhasil dikirim", payment });
});

const settleSchema = z.object({
    groupId: z.string().uuid("ID grup tidak valid"),
    counterpartyId: z.string().uuid("ID user tidak valid"),
    note: z.string().max(500).optional(),
});

// POST /payments/settle — lunasi selisih: satu transfer menutup semua share dua arah dengan satu orang
router.post('/settle', authenticate, async (req: Request, res: Response) => {
    const parsed = settleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const { groupId, counterpartyId, note } = parsed.data;
    const currentUserId = res.locals.user.userId;

    if (counterpartyId === currentUserId) {
        return res.status(400).json({ message: "Tidak bisa melunasi utang ke diri sendiri" });
    }

    const members = await prisma.groupMember.count({
        where: { groupId, userId: { in: [currentUserId, counterpartyId] } },
    });
    if (members !== 2) return res.status(403).json({ message: "Kalian berdua harus anggota grup ini" });

    const openShares = await findOpenShares(groupId, [currentUserId, counterpartyId]);
    const plan = planPairSettlement(openShares, currentUserId, counterpartyId);

    if (!plan) {
        return res.status(400).json({ message: "Tidak ada utang-piutang terbuka di antara kalian (atau semuanya sedang menunggu konfirmasi)." });
    }
    if (plan.fromUser !== currentUserId) {
        return res.status(400).json({ message: "Justru dia yang harus membayar selisihnya ke kamu." });
    }

    const payment = await createPaymentWithAllocations({
        groupId,
        fromUser: plan.fromUser,
        toUser: plan.toUser,
        amount: plan.amount,
        note: note || '',
        allocations: plan.allocations,
    });

    await createNotification(
        plan.toUser,
        'PAYMENT_PENDING',
        `${payment.from.name} mengajukan pelunasan selisih Rp ${plan.amount.toLocaleString('id-ID')} untuk ${describeItems(payment.items)}.`,
        payment.id
    );

    return res.status(201).json({ message: "Pengajuan pelunasan selisih berhasil dikirim", payment });
});

export { router as createPaymentRouter };

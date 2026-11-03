import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../lib/httpError";
import { OpenShare } from "./settlement";

// ---------------------------------------------------------------------------
// Bentuk data payment yang dikirim ke frontend
// ---------------------------------------------------------------------------

const userSelect = { id: true, name: true, email: true, avatarUrl: true } as const;

export const paymentInclude = {
    from: { select: userSelect },
    to: { select: userSelect },
    groupActivity: { select: { id: true, name: true } },
    allocations: {
        include: {
            expenseShare: {
                select: { userId: true, expense: { select: { id: true, description: true } } },
            },
        },
    },
} satisfies Prisma.PaymentInclude;

type PaymentWithRelations = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

export function serializePayment(p: PaymentWithRelations) {
    const items = p.allocations.map(a => ({
        expenseId: a.expenseShare.expense.id,
        description: a.expenseShare.expense.description,
        amount: Number(a.amount),
        debtorId: a.expenseShare.userId,
    }));

    return {
        id: p.id,
        groupId: p.groupId,
        group: p.groupActivity,
        fromUser: p.fromUser,
        toUser: p.toUser,
        from: p.from,
        to: p.to,
        amount: Number(p.amount),
        note: p.note,
        status: p.status,
        submittedAt: p.submittedAt,
        reviewedAt: p.reviewedAt,
        rejectionNote: p.rejectionNote,
        // 'settlement' = satu transfer menutup beberapa tagihan / dua arah
        kind: items.length > 1 || items.some(i => i.debtorId !== p.fromUser) ? "settlement" : "single",
        items,
    };
}

/** Ringkasan isi payment untuk teks notifikasi. */
export function describeItems(items: { description: string }[]) {
    if (items.length === 1) return `tagihan "${items[0].description}"`;
    return `${items.length} tagihan (selisih bersih)`;
}

// ---------------------------------------------------------------------------
// Query share terbuka
// ---------------------------------------------------------------------------

/**
 * Share di grup yang belum lunas DAN belum tercakup payment aktif (pending/approved),
 * hanya yang melibatkan userIds (sebagai pengutang atau penalang).
 */
export async function findOpenShares(groupId: string, userIds: string[]): Promise<OpenShare[]> {
    const shares = await prisma.expenseShare.findMany({
        where: {
            isPaid: false,
            allocations: { none: { active: true } },
            expense: { groupId },
            OR: [{ userId: { in: userIds } }, { expense: { paidBy: { in: userIds } } }],
        },
        include: { expense: { select: { id: true, description: true, paidBy: true } } },
    });

    return shares
        .filter(s => s.userId !== s.expense.paidBy) // bagian penalang sendiri bukan utang
        .map(s => ({
            shareId: s.id,
            expenseId: s.expense.id,
            description: s.expense.description,
            debtorId: s.userId,
            creditorId: s.expense.paidBy,
            amount: Number(s.shareAmount),
        }));
}

// ---------------------------------------------------------------------------
// Mutasi (semuanya atomic)
// ---------------------------------------------------------------------------

type CreatePaymentInput = {
    groupId: string;
    fromUser: string;
    toUser: string;
    amount: number;
    note: string;
    allocations: { shareId: string; amount: number }[];
};

/**
 * Membuat payment + alokasinya dalam satu transaksi.
 *
 * Race condition (dua pengajuan bersamaan untuk share yang sama) TIDAK dicegah dengan
 * "cek dulu baru insert" (check-then-act selalu punya celah di antara cek dan insert),
 * melainkan oleh partial unique index `payment_allocations_active_share_key`:
 * insert kedua pasti gagal di level database, lalu kita terjemahkan jadi 409.
 */
export async function createPaymentWithAllocations(input: CreatePaymentInput) {
    try {
        const payment = await prisma.payment.create({
            data: {
                groupId: input.groupId,
                fromUser: input.fromUser,
                toUser: input.toUser,
                amount: input.amount,
                note: input.note,
                status: "pending",
                allocations: {
                    create: input.allocations.map(a => ({ expenseShareId: a.shareId, amount: a.amount })),
                },
            },
            include: paymentInclude,
        });
        return serializePayment(payment);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new HttpError(409, "Sebagian tagihan sudah diajukan pelunasannya dan masih menunggu konfirmasi.");
        }
        throw err;
    }
}

/** Jelaskan kenapa payment tidak bisa direview (dipanggil setelah update bersyarat gagal). */
async function explainReviewFailure(paymentId: string, reviewerId: string): Promise<never> {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { toUser: true } });
    if (!payment) throw new HttpError(404, "Pengajuan tidak ditemukan");
    if (payment.toUser !== reviewerId) throw new HttpError(403, "Bukan hakmu mereview pengajuan ini");
    throw new HttpError(409, "Pengajuan sudah diproses sebelumnya");
}

/**
 * Menyetujui payment. Atomic terhadap request ganda:
 * `updateMany ... WHERE status = 'pending'` dieksekusi Postgres dengan row lock, jadi dari dua
 * request bersamaan hanya satu yang mendapat count = 1. Yang lain mendapat 0 -> 409.
 */
export async function approvePayment(paymentId: string, reviewerId: string) {
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
        const { count } = await tx.payment.updateMany({
            where: { id: paymentId, toUser: reviewerId, status: "pending" },
            data: { status: "approved", reviewedAt: now },
        });
        if (count === 0) return null;

        const allocations = await tx.paymentAllocation.findMany({
            where: { paymentId, active: true },
            select: { expenseShareId: true },
        });
        await tx.expenseShare.updateMany({
            where: { id: { in: allocations.map(a => a.expenseShareId) } },
            data: { isPaid: true, paidAt: now },
        });

        return tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: paymentInclude });
    });

    if (!updated) return explainReviewFailure(paymentId, reviewerId);
    return serializePayment(updated);
}

/** Menolak payment; alokasinya dinonaktifkan supaya share bisa diajukan ulang. */
export async function rejectPayment(paymentId: string, reviewerId: string, rejectionNote: string | null) {
    const updated = await prisma.$transaction(async (tx) => {
        const { count } = await tx.payment.updateMany({
            where: { id: paymentId, toUser: reviewerId, status: "pending" },
            data: { status: "rejected", reviewedAt: new Date(), rejectionNote },
        });
        if (count === 0) return null;

        await tx.paymentAllocation.updateMany({ where: { paymentId }, data: { active: false } });

        return tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: paymentInclude });
    });

    if (!updated) return explainReviewFailure(paymentId, reviewerId);
    return serializePayment(updated);
}

/** Dipakai saat edit/hapus tagihan: tolak kalau ada share yang sedang diajukan pelunasannya. */
export async function assertNoPendingPayments(shareIds: string[]) {
    const pending = await prisma.paymentAllocation.count({
        where: { expenseShareId: { in: shareIds }, active: true, payment: { status: "pending" } },
    });
    if (pending > 0) {
        throw new HttpError(409, "Masih ada pengajuan pelunasan yang menunggu konfirmasi untuk tagihan ini. Setujui atau tolak dulu.");
    }
}

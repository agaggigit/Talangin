import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import z from "zod";
import { assertNoPendingPayments } from "../payments/paymentService";

const router = Router();

// Re-use schema dari createExpense
const expenseShareSchema = z.object({
    userId: z.string().uuid("ID user tidak valid"),
    shareAmount: z.number().positive("Nominal pembagian harus lebih dari 0")
});

const updateExpenseSchema = z.object({
    description: z.string().min(3, "Deskripsi minimal 3 karakter"),
    totalAmount: z.number().positive("Total tagihan harus lebih dari 0"),
    expenseDate: z.string().datetime("Format tanggal tidak valid"),
    shares: z.array(expenseShareSchema).min(1, "Minimal harus ada 1 orang yang ditagih")
}).refine((data) => {
    const sumOfShares = data.shares.reduce((sum, share) => sum + share.shareAmount, 0);
    return Math.abs(sumOfShares - data.totalAmount) < 0.01;
}, {
    message: "Total pembagian (shares) tidak sama dengan total tagihan (totalAmount)",
    path: ["shares"]
});

// PUT & PATCH sama-sama diterima (frontend memakai PATCH)
router.put('/:id', authenticate, handleUpdate);
router.patch('/:id', authenticate, handleUpdate);

async function handleUpdate(req: Request, res: Response) {
    const result = updateExpenseSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ errors: result.error.flatten().fieldErrors });
    }

    const expenseId = req.params.id as string;
    const userId = res.locals.user.userId;
    const { description, totalAmount, expenseDate, shares } = result.data;

    // 1. Ambil data lama
    const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: { shares: true }
    });

    if (!expense) {
        return res.status(404).json({ message: "Tagihan tidak ditemukan" });
    }

    // 2. Validasi Hak Akses (Hanya Peyer)
    if (expense.paidBy !== userId) {
        return res.status(403).json({ message: "Kamu bukan penombok tagihan ini, tidak berhak mengedit." });
    }

    // 3. Cek kondisi "Apakah ada yang sudah lunas selain pembuat?"
    const hasPaidShares = expense.shares.some(share => share.isPaid && share.userId !== userId);

    if (!hasPaidShares) {
        // Share lama akan diganti; jangan sampai ada pengajuan pending yang ikut hilang.
        await assertNoPendingPayments(expense.shares.map(s => s.id));
    }

    await prisma.$transaction(async (tx) => {
        if (hasPaidShares) {
            // JIKA TERKUNCI: Hanya boleh update Judul dan Tanggal
            await tx.expense.update({
                where: { id: expenseId },
                data: {
                    description,
                    expenseDate: new Date(expenseDate)
                }
            });
        } else {
            // JIKA BEBAS: Update Semua (termasuk menghapus semua share lama dan membuat yang baru)
            
            // Hapus shares lama (alokasi payment yang sudah ditolak ikut terhapus via cascade)
            await tx.expenseShare.deleteMany({
                where: { expenseId: expenseId }
            });

            // Update info tagihan
            await tx.expense.update({
                where: { id: expenseId },
                data: {
                    description,
                    totalAmount,
                    expenseDate: new Date(expenseDate)
                }
            });

            // Buat shares baru
            const expenseSharesData = shares.map(share => ({
                expenseId: expenseId,
                userId: share.userId,
                shareAmount: share.shareAmount,
                isPaid: share.userId === userId // otomatis lunas jika dirinya sendiri
            }));

            await tx.expenseShare.createMany({
                data: expenseSharesData
            });
        }
    });

    return res.status(200).json({ message: "Tagihan berhasil diperbarui.", isLocked: hasPaidShares });
}

export { router as updateExpenseRouter };

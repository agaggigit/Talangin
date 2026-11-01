import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import z from "zod";

const router = Router();

// Skema untuk satu buah pembagian tagihan (share)
const expenseShareSchema = z.object({
    userId: z.string().uuid("ID user tidak valid"),
    shareAmount: z.number().positive("Nominal pembagian harus lebih dari 0")
});

// Skema validasi utama untuk Endpoint Pembuatan Expense
const createExpenseSchema = z.object({
    description: z.string().min(3, "Deskripsi minimal 3 karakter"),
    totalAmount: z.number().positive("Total tagihan harus lebih dari 0"),
    expenseDate: z.string().datetime("Format tanggal tidak valid"), // Berupa string ISO-8601 (YYYY-MM-DDTHH:mm:ssZ)
    shares: z.array(expenseShareSchema).min(1, "Minimal harus ada 1 orang yang ditagih")
}).refine((data) => {
    // Kustom Validasi: Pastikan jumlah dari semua shareAmount sama dengan totalAmount
    const sumOfShares = data.shares.reduce((sum, share) => sum + share.shareAmount, 0);
    
    // Membulatkan ke 2 angka desimal untuk menghindari isu presisi floating point Javascript
    return Math.abs(sumOfShares - data.totalAmount) < 0.01;
}, {
    message: "Total pembagian (shares) tidak sama dengan total tagihan (totalAmount)",
    path: ["shares"] // Menandai bahwa error ada di bagian array shares
});

router.post('/:id/expenses', authenticate, async (req: Request, res: Response) => {
    const result = createExpenseSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            errors: result.error.flatten().fieldErrors
        });
    }

    const groupId = req.params.id as string;
    const paidByUserId = res.locals.user.userId; // Orang yang sedang login = orang yang menalangi (paidBy)
    const { description, totalAmount, expenseDate, shares } = result.data;

    // 1. Penalang harus anggota grup
    const isPayerGroupMember = await prisma.groupMember.findFirst({
        where: {
            groupId: groupId,
            userId: paidByUserId
        }
    });

    if (!isPayerGroupMember) {
        return res.status(403).json({ message: "Kamu bukan anggota grup ini" });
    }

    // 2. Semua yang ditagih harus anggota grup, dan tidak boleh ada user ganda
    const userIdInShares = shares.map(share => share.userId);
    if (new Set(userIdInShares).size !== userIdInShares.length) {
        return res.status(400).json({ message: "Ada pengguna yang ditagih lebih dari sekali" });
    }
    
    const isDebtorGroupMember = await prisma.groupMember.findMany({
        where: {
            groupId: groupId,
            userId: {
                in: userIdInShares
            }
        }
    });

    if (isDebtorGroupMember.length !== shares.length) {
        return res.status(400).json({ message: "Ada pengguna yang ditagih tapi bukan anggota grup" })
    } 

    // 3. Simpan tagihan + pembagiannya secara atomik
    const created = await prisma.$transaction(async (tx) => {
        const expense = await tx.expense.create({
            data: {
                groupId: groupId,
                paidBy: paidByUserId,
                description: description,
                totalAmount: totalAmount,
                expenseDate: new Date(expenseDate)
            }
        });

        const expenseSharesData = shares.map(share => ({
            expenseId: expense.id,
            userId: share.userId,
            shareAmount: share.shareAmount,
            isPaid: share.userId === paidByUserId // Otomatis lunas jika dia yang menalangi
        }));
        
        await tx.expenseShare.createMany({
            data: expenseSharesData
        });

        return tx.expense.findUniqueOrThrow({ where: { id: expense.id }, include: { shares: true } });
    });

    return res.status(201).json({ message: "Tagihan berhasil dibuat!", expense: created });

});

export { router as createExpenseRouter };

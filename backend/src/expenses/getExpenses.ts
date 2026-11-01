import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import { latestPaymentPerShare } from "./sharePayments";

const router = Router();

router.get('/:id/expenses', authenticate, async (req: Request, res: Response) => {
    const groupId = req.params.id as string;
    const userId = res.locals.user.userId;

    const isMember = await prisma.groupMember.findFirst({
        where: {
            groupId: groupId,
            userId: userId
        }
    });

    if (!isMember) {
        return res.status(403).json({ message: "Kamu bukan anggota grup ini" });
    }

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filter: keyword, rentang tanggal, peran/status
    const keyword = req.query.keyword as string;
    const startDateQuery = req.query.startDate as string;
    const endDateQuery = req.query.endDate as string;
    const filterType = req.query.filterType as string;

    const whereClause: any = { groupId: groupId };
    
    // 1. Filter Keyword (Mencari di deskripsi)
    if (keyword) {
        whereClause.description = {
            contains: keyword
        };
    }

    // 2. Filter Rentang Tanggal
    if (startDateQuery || endDateQuery) {
        whereClause.expenseDate = {};
        if (startDateQuery) {
            const startDate = new Date(startDateQuery);
            startDate.setHours(0, 0, 0, 0);
            whereClause.expenseDate.gte = startDate;
        }
        if (endDateQuery) {
            const endDate = new Date(endDateQuery);
            endDate.setHours(23, 59, 59, 999);
            whereClause.expenseDate.lte = endDate;
        }
    }

    // 3. Filter Peran/Status (terlibat, belum lunas, ditalangi)
    if (filterType) {
        if (filterType === 'involved') {
            whereClause.shares = {
                some: { userId: userId }
            };
        } else if (filterType === 'unpaid') {
            whereClause.shares = {
                some: { userId: userId, isPaid: false }
            };
            // Pastikan tagihan yang ditalangi sendiri tidak dianggap 'Belum Lunas'
            whereClause.paidBy = {
                not: userId
            };
        } else if (filterType === 'payer') {
            whereClause.paidBy = userId;
        }
    }

    const expenses = await prisma.expense.findMany({
        where: whereClause, // Gunakan where dinamis yang kita buat
        skip: skip,
        take: limit,
        include: {
            shares: {
                include: {
                    allocations: {
                        orderBy: { payment: { submittedAt: 'desc' } },
                        take: 1,
                        select: { payment: { select: { id: true, status: true } } }
                    }
                }
            },
            paidByUser: {
                select: {
                    name: true
                }
            }
        },
        orderBy: [
            { expenseDate: 'desc' },
            { createdAt: 'desc' }
        ]
    });
    
    return res.status(200).json(expenses.map(latestPaymentPerShare));

});

export { router as getExpensesRouter };

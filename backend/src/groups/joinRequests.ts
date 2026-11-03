import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import z from "zod";
import { createNotification } from "../notifications/notificationService";

const router = Router()

router.get('/:id/join-requests', authenticate, async (req: Request, res: Response)=> {
    const groupId = req.params.id as string;
    const userId = res.locals.user.userId;

    const isAuthhorized = await prisma.groupMember.findFirst({
        where: {
            groupId: groupId,
            userId: userId,
            role: 'host'
        }
    });

    if (!isAuthhorized) {
        return res.status(403).json({ message: 'Hanya Host yang dapat melihat permintaan bergabung' })
    }

    const joinRequest = await prisma.groupJoinRequest.findMany({
        where: {
            groupId : groupId,
            status: 'pending'
        },
        select: {
            id: true,
            groupId: true,
            userId: true,
            status: true,
            requestedAt: true,
            user: {
                select: { 
                    id: true, 
                    name: true, 
                    avatarUrl: true 
                } 
            }
        }
    });

    return res.status(200).json(joinRequest);
});

const joinRequestApprovalSchema = z.object({
    status: z.enum(['approved', 'rejected'])
});

router.patch('/:id/join-requests/:requestId', authenticate, async (req: Request, res: Response) => {
    const result = joinRequestApprovalSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            errors: result.error.flatten().fieldErrors
        });
    }

    try {
        const groupId = req.params.id as string;
        const reqId = req.params.requestId as string;
        const userId = res.locals.user.userId;
        const { status } = result.data;

        const isAuthhorized = await prisma.groupMember.findFirst({
            where: {
                groupId: groupId,
                userId: userId,
                role: 'host'
            }
        });

        if (!isAuthhorized) {
            return res.status(403).json({ message: 'Hanya Host yang dapat melihat permintaan bergabung' })
        }

        const joinRequest = await prisma.groupJoinRequest.findFirst({
            where: { id: reqId },
            select: {
                id: true,
                groupId: true,
                userId: true,
                status: true,
                requestedAt: true,
                user: {
                    select: { 
                        id: true, 
                        name: true, 
                        avatarUrl: true 
                    } 
                }
            }
        });

        if (!joinRequest) {
            return res.status(404).json({ message: 'Request tidak ditemukan' });
        }

        if (joinRequest.status !== 'pending') {
            return res.status(400).json({ message: 'Pengguna ini sudah tidak pending' })
        }

        if (status == 'rejected') {
            await prisma.groupJoinRequest.update({
                where: { id: reqId },
                data: {
                    status: 'rejected',
                    reviewedAt: new Date()
                }
            });

            // Notifikasi
            const group = await prisma.group.findUnique({ where: { id: groupId }});
            if (group) {
                await createNotification(
                    joinRequest.userId,
                    'JOIN_REJECTED',
                    `Permintaan bergabungmu ke grup "${group.name}" ditolak oleh Host.`,
                    joinRequest.id
                );
            }

            return res.status(200).json({ message: 'Permintaan bergabung ditolak' })
        } else {
            await prisma.$transaction(async (tx) => {
                await tx.groupJoinRequest.update({
                    where: { id: reqId },
                    data: {
                        status: 'approved',
                        reviewedAt: new Date()
                    }
                });

                await tx.groupMember.create({
                    data: {
                        groupId: groupId,
                        userId: joinRequest.userId,
                        role: 'member'
                    }
                });
            });
            
            // Notifikasi
            const group = await prisma.group.findUnique({ where: { id: groupId }});
            if (group) {
                await createNotification(
                    joinRequest.userId,
                    'JOIN_APPROVED',
                    `Permintaan bergabungmu ke grup "${group.name}" disetujui! Selamat datang.`,
                    joinRequest.id
                );
            }

            return res.status(200).json({ message: 'Berhasil menyetujui permintaan bergabung' });
        }
    } catch(error) {
        console.error(500);
        return res.status(500).json({ message: 'Gagal mengubah status permintaan pengguna' });
    }
});

export { router as joinRequestRouter }

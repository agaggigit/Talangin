import { Prisma } from "@prisma/client";
import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../db";
import z from "zod";
import crypto from "crypto";

const router = Router();

const editGroupSchema = z.object({
    name: z.string().min(3, "Nama grup minimal 3 karakter").optional(),
    joinApprovalRequired: z.boolean().optional(),    
    regenerateInviteCode: z.boolean().optional().default(false)        
});

router.patch('/:id', authenticate, async (req: Request, res: Response) => {
    const result = editGroupSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            errors: result.error.flatten().fieldErrors
        });
    }
    
    const groupId = req.params.id as string;
    const userId = res.locals.user.userId;
    
    const { name, joinApprovalRequired, regenerateInviteCode } = result.data;

    // Hanya host yang boleh mengubah pengaturan grup
    const userRole = await prisma.groupMember.findFirst({
        where: {
            userId: userId,
            groupId: groupId
        },
        select: {
            role: true
        }
    });

    if (!userRole || userRole.role !== 'host') {
        return res.status(403).json({ message: 'Hanya Host yang dapat mengubah pengaturan grup' })
    }
    
    const updateData: Prisma.GroupUpdateInput = {};
    
    if (name !== undefined) {
        updateData.name = name;
    }
    
    if (joinApprovalRequired !== undefined) {
        updateData.joinApprovalRequired = joinApprovalRequired;
    }
    
    if (regenerateInviteCode) {
        updateData.inviteCode = crypto.randomBytes(4).toString('hex')
    }

    const updatedGroup = await prisma.group.update({
        where: {
            id: groupId,
        },
        data: updateData
    });

    return res.status(200).json({ message: 'Pengaturan grup berhasil diperbarui', group: updatedGroup });
    
});

export { router as groupSettingsRouter };

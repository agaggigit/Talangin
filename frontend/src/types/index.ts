export interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
}

export interface Group {
    id: string;
    name: string;
    joinCode: string;
    inviteCode?: string;
    joinApprovalRequired?: boolean;
    hostId: string;
    host?: User;
    memberships?: GroupMembership[];
}

export interface GroupMembership {
    id: string;
    userId: string;
    groupId: string;
    user?: User;
    group?: Group;
}

export interface Expense {
    id: string;
    description: string;
    totalAmount: number | string;
    expenseDate: string;
    groupId: string;
    paidBy: string;
    paidByUser?: User;
    group?: Group;
    shares: ExpenseShare[];
}

export interface ExpenseShare {
    id: string;
    expenseId: string;
    userId: string;
    shareAmount: number | string;
    isPaid: boolean;
    user?: User;
    expense?: Expense;
    payments?: Payment[];
}

/** Status pengajuan terbaru pada satu share (dari /expenses). */
export interface Payment {
    id: string;
    status: PaymentStatus;
    note?: string;
    amount?: number | string;
}

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface UserLite {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string | null;
}

/** Tagihan yang tertutup oleh satu pembayaran. */
export interface PaymentItem {
    expenseId: string;
    description: string;
    amount: number;
    debtorId: string;
}

/** Satu transfer (bisa menutup banyak tagihan sekaligus, termasuk dua arah). */
export interface PaymentSummary {
    id: string;
    groupId: string | null;
    group: { id: string; name: string } | null;
    fromUser: string;
    toUser: string;
    from: UserLite;
    to: UserLite;
    amount: number;
    note: string;
    status: PaymentStatus;
    submittedAt: string;
    reviewedAt: string | null;
    rejectionNote: string | null;
    kind: 'single' | 'settlement';
    items: PaymentItem[];
}

export interface SettlePreview {
    counterparty: { id: string; name: string };
    plan: {
        fromUser: string;
        toUser: string;
        amount: number;
        grossFromOwes: number;
        grossToOwes: number;
        iPay: boolean;
        theyPay: boolean;
        allocations: { shareId: string; amount: number; expenseId: string; description: string; debtorId: string }[];
    } | null;
    pendingCount: number;
}

export interface SettlementPlan {
    transfers: { from: UserLite; to: UserLite; amount: number }[];
    directTransferCount: number;
}

export interface Notification {
    id: string;
    userId: string;
    type: 'payment_submitted' | 'payment_verified' | 'payment_rejected' | 'join_request' | 'expense_added' | 'group_joined';
    title: string;
    message: string;
    isRead: boolean;
    data: any; // Data bisa sangat bervariasi bergantung type, bisa kita type perlahan nanti jika dibutuhkan, tapi sementara kita kasih Record<string, unknown> atau spesifik
    createdAt: string;
}

export interface JoinRequest {
    id: string;
    userId: string;
    groupId: string;
    status: 'pending' | 'approved' | 'rejected';
    user: User;
    createdAt: string;
}

// Untuk tipe spesifik pada Data Notification (Opsional namun disarankan)
export interface NotificationDataPayment {
    paymentId: string;
    expenseId?: string;
}

export interface NotificationDataJoinRequest {
    requestId: string;
    groupId: string;
}

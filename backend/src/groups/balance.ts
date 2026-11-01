import { toCents, fromCents } from "../lib/money";

// pending = tagihan ini sedang tercakup pengajuan pelunasan yang menunggu konfirmasi
type Transaction = { id: string; description: string; amount: number; iOweThem: boolean; pending: boolean };

type PersonBalance = {
    userId: string;
    name: string;
    amount: number;
    transactions: Transaction[];
}

type UserRef = {
    name: string;
}

type Share = {
    userId:  string;
    shareAmount: number;
    user: UserRef;
    pending?: boolean;
}

type ExpenseInput = {
    id: string;
    description: string;
    paidBy: string;
    paidByUser: UserRef;
    shares: Share[];
};

// Akumulator internal: nominal disimpan dalam sen (integer) agar penjumlahan presisi.
type Accumulator = { userId: string; name: string; cents: number; transactions: Transaction[] };

function addTo(map: Map<string, Accumulator>, userId: string, name: string, tx: Transaction) {
    const acc = map.get(userId) || { userId, name, cents: 0, transactions: [] };
    acc.cents += toCents(tx.amount);
    acc.transactions.push(tx);
    map.set(userId, acc);
}

function toPersonBalances(map: Map<string, Accumulator>): PersonBalance[] {
    return Array.from(map.values()).map(({ cents, ...rest }) => ({ ...rest, amount: fromCents(cents) }));
}

/**
 * Ringkasan utang-piutang currentUser dalam satu grup, dihitung GROSS:
 * utang ke Budi dan piutang dari Budi ditampilkan terpisah (tidak di-netting),
 * supaya setiap tagihan tetap bisa ditelusuri. Netting dilakukan saat settle up.
 */
export function computeBalances(expenses: ExpenseInput[], currentUserId: string) {
    // Orang lain -> berutang ke currentUser
    const owedToMeMap = new Map<string, Accumulator>();
    // currentUser -> berutang ke orang lain
    const iOweMap = new Map<string, Accumulator>();

    for (const exp of expenses) {
        if (exp.paidBy === currentUserId) {
            for (const share of exp.shares) {
                if (share.userId === currentUserId) continue; // bagian diri sendiri bukan utang
                addTo(owedToMeMap, share.userId, share.user.name, {
                    id: exp.id, description: exp.description, amount: share.shareAmount, iOweThem: false, pending: share.pending ?? false,
                });
            }
        } else {
            const myShare = exp.shares.find(s => s.userId === currentUserId);
            if (myShare) {
                addTo(iOweMap, exp.paidBy, exp.paidByUser.name, {
                    id: exp.id, description: exp.description, amount: myShare.shareAmount, iOweThem: true, pending: myShare.pending ?? false,
                });
            }
        }
    }

    const owedToMe = toPersonBalances(owedToMeMap);
    const iOwe = toPersonBalances(iOweMap);

    const totalOwedToMe = fromCents(owedToMe.reduce((sum, b) => sum + toCents(b.amount), 0));
    const totalIOwe = fromCents(iOwe.reduce((sum, b) => sum + toCents(b.amount), 0));

    return {
        iOwe,
        owedToMe,
        totalIOwe,
        totalOwedToMe
    };
}

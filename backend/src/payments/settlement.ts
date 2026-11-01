import { toCents, fromCents } from "../lib/money";

/** Share yang belum lunas dan belum terkunci oleh payment lain. */
export type OpenShare = {
    shareId: string;
    expenseId: string;
    description: string;
    debtorId: string;   // pemilik share (yang berutang)
    creditorId: string; // penalang tagihan (yang dihutangi)
    amount: number;     // rupiah
};

export type PairSettlement = {
    fromUser: string;
    toUser: string;
    /** Nominal yang benar-benar ditransfer = selisih bersih kedua arah. */
    amount: number;
    /** Total utang fromUser -> toUser sebelum netting. */
    grossFromOwes: number;
    /** Total utang toUser -> fromUser sebelum netting. */
    grossToOwes: number;
    /** Semua share (dua arah) yang dianggap lunas setelah transfer ini disetujui. */
    allocations: { shareId: string; amount: number; expenseId: string; description: string; debtorId: string }[];
};

/**
 * "Lunasi selisih" antara dua orang.
 * Contoh: aku utang 50rb ke Budi, Budi utang 30rb ke aku -> aku transfer 20rb,
 * dan kelima share di kedua arah ditutup oleh SATU payment.
 *
 * Mengembalikan null kalau tidak ada share terbuka di antara keduanya.
 */
export function planPairSettlement(shares: OpenShare[], userA: string, userB: string): PairSettlement | null {
    const between = shares.filter(s =>
        (s.debtorId === userA && s.creditorId === userB) ||
        (s.debtorId === userB && s.creditorId === userA)
    );
    if (between.length === 0) return null;

    let aOwesCents = 0;
    let bOwesCents = 0;
    for (const s of between) {
        if (s.debtorId === userA) aOwesCents += toCents(s.amount);
        else bOwesCents += toCents(s.amount);
    }

    // Yang utangnya lebih besar adalah pengirim. Kalau seimbang, A dianggap pengirim (nominal 0).
    const aPays = aOwesCents >= bOwesCents;
    const fromOwes = aPays ? aOwesCents : bOwesCents;
    const toOwes = aPays ? bOwesCents : aOwesCents;

    return {
        fromUser: aPays ? userA : userB,
        toUser: aPays ? userB : userA,
        amount: fromCents(fromOwes - toOwes),
        grossFromOwes: fromCents(fromOwes),
        grossToOwes: fromCents(toOwes),
        allocations: between.map(s => ({
            shareId: s.shareId,
            amount: s.amount,
            expenseId: s.expenseId,
            description: s.description,
            debtorId: s.debtorId,
        })),
    };
}

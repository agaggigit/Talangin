import { toCents, fromCents } from "../lib/money";

export type Debt = { debtorId: string; creditorId: string; amount: number };
export type Transfer = { from: string; to: string; amount: number };

/**
 * Saldo bersih tiap orang dalam grup (dalam sen).
 * Positif = harus menerima uang, negatif = harus membayar.
 * Jumlah seluruh saldo selalu 0 (uang tidak muncul/hilang).
 */
export function netBalances(debts: Debt[]): Map<string, number> {
    const net = new Map<string, number>();
    for (const d of debts) {
        if (d.debtorId === d.creditorId) continue;
        const cents = toCents(d.amount);
        net.set(d.debtorId, (net.get(d.debtorId) ?? 0) - cents);
        net.set(d.creditorId, (net.get(d.creditorId) ?? 0) + cents);
    }
    return net;
}

/**
 * Penyederhanaan utang grup (gaya Splitwise).
 *
 * Ide: siapa berutang ke siapa tidak penting, yang penting saldo bersih tiap orang.
 * Algoritma greedy: pasangkan pengutang terbesar dengan penerima terbesar, transfer
 * sebesar min(keduanya), ulangi. Setiap langkah membuat minimal satu orang saldonya 0,
 * jadi hasilnya paling banyak (n - 1) transfer untuk n orang yang saldonya tidak nol,
 * dibanding bisa sampai n(n-1)/2 kalau setiap utang dibayar langsung.
 *
 * Catatan: mencari jumlah transfer yang benar-benar minimum adalah masalah NP-hard
 * (bisa direduksi dari subset-sum). Greedy ini adalah aproksimasi standar yang dipakai di praktik.
 * Kompleksitas: O(n log n) untuk sorting + O(n) untuk pencocokan.
 */
export function simplifyDebts(debts: Debt[]): Transfer[] {
    const net = netBalances(debts);

    const creditors: { id: string; cents: number }[] = [];
    const debtors: { id: string; cents: number }[] = [];
    for (const [id, cents] of net) {
        if (cents > 0) creditors.push({ id, cents });
        else if (cents < 0) debtors.push({ id, cents: -cents });
    }

    // Urutkan terbesar dulu; id sebagai tie-breaker supaya hasil deterministik (mudah dites).
    const byAmountDesc = (a: { id: string; cents: number }, b: { id: string; cents: number }) =>
        b.cents - a.cents || a.id.localeCompare(b.id);
    creditors.sort(byAmountDesc);
    debtors.sort(byAmountDesc);

    const transfers: Transfer[] = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
        const pay = Math.min(debtors[i].cents, creditors[j].cents);
        transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: fromCents(pay) });

        debtors[i].cents -= pay;
        creditors[j].cents -= pay;
        if (debtors[i].cents === 0) i++;
        if (creditors[j].cents === 0) j++;
    }

    return transfers;
}

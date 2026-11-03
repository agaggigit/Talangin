import { describe, it, expect } from "vitest";
import { simplifyDebts, netBalances, Debt, Transfer } from "./simplifyDebts";

const debt = (debtorId: string, creditorId: string, amount: number): Debt => ({ debtorId, creditorId, amount });

/** Terapkan transfer ke saldo bersih; hasilnya harus nol semua. */
function applyTransfers(debts: Debt[], transfers: Transfer[]) {
  const net = netBalances(debts);
  for (const t of transfers) {
    net.set(t.from, (net.get(t.from) ?? 0) + Math.round(t.amount * 100));
    net.set(t.to, (net.get(t.to) ?? 0) - Math.round(t.amount * 100));
  }
  return [...net.values()];
}

describe("simplifyDebts", () => {
  it("rantai utang A->B->C diringkas jadi A->C", () => {
    const debts = [debt("A", "B", 10000), debt("B", "C", 10000)];

    expect(simplifyDebts(debts)).toEqual([{ from: "A", to: "C", amount: 10000 }]);
  });

  it("utang dua arah langsung dinetting", () => {
    expect(simplifyDebts([debt("A", "B", 50000), debt("B", "A", 30000)])).toEqual([
      { from: "A", to: "B", amount: 20000 },
    ]);
  });

  it("utang yang saling menghapus (siklus) tidak menghasilkan transfer", () => {
    expect(simplifyDebts([debt("A", "B", 5000), debt("B", "C", 5000), debt("C", "A", 5000)])).toEqual([]);
  });

  it("jumlah transfer paling banyak n-1 dan semua saldo jadi nol", () => {
    // 4 orang, 6 utang langsung (setiap pasangan)
    const debts = [
      debt("A", "B", 12000), debt("A", "C", 7000), debt("A", "D", 3000),
      debt("B", "C", 9000), debt("B", "D", 4000), debt("C", "D", 11000),
    ];
    const transfers = simplifyDebts(debts);

    expect(transfers.length).toBeLessThanOrEqual(3);
    expect(applyTransfers(debts, transfers).every(v => v === 0)).toBe(true);
    expect(transfers.every(t => t.amount > 0)).toBe(true);
  });

  it("utang ke diri sendiri diabaikan", () => {
    expect(simplifyDebts([debt("A", "A", 10000)])).toEqual([]);
  });

  it("nominal desimal tidak meninggalkan sisa sen", () => {
    const debts = [debt("A", "B", 0.1), debt("A", "B", 0.2), debt("C", "B", 0.3)];
    const transfers = simplifyDebts(debts);

    expect(applyTransfers(debts, transfers).every(v => v === 0)).toBe(true);
    expect(transfers).toContainEqual({ from: "A", to: "B", amount: 0.3 });
  });
});

import { describe, it, expect } from "vitest";
import { computeBalances } from "./balance";

// Helper: bikin satu tagihan tanpa harus nulis objek panjang.
// Contoh: tagihan("e1", "aku", { aku: 50000, budi: 50000 })
function tagihan(id: string, paidBy: string, shares: Record<string, number>) {
  return {
    id,
    description: `Tagihan ${id}`,
    paidBy,
    paidByUser: { name: paidBy },
    shares: Object.entries(shares).map(([userId, shareAmount]) => ({
      userId,
      shareAmount,
      user: { name: userId },
    })),
  };
}

describe("computeBalances", () => {
  it("anggota lain berutang ke aku kalau aku yang menalangi", () => {
    const result = computeBalances([tagihan("e1", "aku", { aku: 50000, budi: 50000 })], "aku");

    expect(result.totalOwedToMe).toBe(50000);
    expect(result.owedToMe[0].userId).toBe("budi");
  });

  it("menalangi diri sendiri tidak menghasilkan utang/piutang", () => {
    const result = computeBalances([tagihan("e1", "aku", { aku: 10000 })], "aku");

    expect(result.iOwe).toEqual([]);
    expect(result.owedToMe).toEqual([]);
    expect(result.totalIOwe).toBe(0);
  });

  it("aku berutang kalau orang lain yang menalangi", () => {
    const result = computeBalances([tagihan("e1", "budi", { aku: 2000, budi: 2000 })], "aku");

    expect(result.iOwe[0].userId).toBe("budi");
    expect(result.iOwe[0].amount).toBe(2000);
    expect(result.iOwe[0].transactions[0].iOweThem).toBe(true);
  });

  it("tagihan yang tidak melibatkan aku diabaikan", () => {
    const result = computeBalances([tagihan("e1", "budi", { budi: 5000, citra: 5000 })], "aku");

    expect(result.iOwe).toEqual([]);
    expect(result.owedToMe).toEqual([]);
  });

  it("utang dua arah dengan orang yang sama tetap di gross", () => {
    const result = computeBalances(
      [
        tagihan("e1", "aku", { aku: 50000, budi: 50000 }),
        tagihan("e2", "budi", { aku: 30000, budi: 30000 }),
      ],
      "aku",
    );

    expect(result.owedToMe).toHaveLength(1);
    expect(result.owedToMe[0].amount).toBe(50000);
    expect(result.owedToMe[0].transactions).toHaveLength(1);
    expect(result.iOwe).toEqual([{ userId: "budi", name: "budi", amount: 30000, transactions: [{ id: "e2", description: "Tagihan e2", amount: 30000, iOweThem: true, pending: false }] }]);
  });

  it("utang dan piutang dengan nominal sama tetap di gross", () => {
    const result = computeBalances(
      [
        tagihan("e1", "aku", { aku: 30000, budi: 30000 }),
        tagihan("e2", "budi", { aku: 30000, budi: 30000 }),
      ],
      "aku",
    );

    expect(result.owedToMe).toHaveLength(1);
    expect(result.iOwe).toHaveLength(1);
    expect(result.owedToMe[0].amount).toBe(30000);
    expect(result.iOwe[0].amount).toBe(30000);
  });

  it("beberapa tagihan ke orang yang sama digabung jadi satu baris", () => {
    const result = computeBalances(
      [
        tagihan("e1", "aku", { aku: 10000, budi: 10000 }),
        tagihan("e2", "aku", { aku: 5000, budi: 5000 }),
      ],
      "aku",
    );

    expect(result.owedToMe).toHaveLength(1);
    expect(result.owedToMe[0].amount).toBe(15000);
    expect(result.owedToMe[0].transactions).toHaveLength(2);
  });

  it("piutang dari beberapa orang dijumlah", () => {
    const result = computeBalances(
      [tagihan("e1", "aku", { aku: 10000, budi: 10000, citra: 10000 })],
      "aku",
    );

    expect(result.owedToMe).toHaveLength(2);
    expect(result.totalOwedToMe).toBe(20000);
  });

  it("tidak ada tagihan sama sekali", () => {
    const result = computeBalances([], "aku");

    expect(result).toEqual({ iOwe: [], owedToMe: [], totalIOwe: 0, totalOwedToMe: 0 });
  });

  it("angka desimal dijumlah dengan presisi", () => {
    const result = computeBalances(
      [
        tagihan("e1", "aku", { aku: 0.3, budi: 0.3 }),
        tagihan("e2", "budi", { aku: 0.1, budi: 0.1 }),
        tagihan("e3", "budi", { aku: 0.2, budi: 0.2 }),
      ],
      "aku",
    );

    // Secara logika uang: utangku ke Budi = 0.1 + 0.2
    expect(result.owedToMe).toHaveLength(1);
    expect(result.iOwe).toHaveLength(1);
    expect(result.iOwe[0].amount).toBe(0.3);
  });
});

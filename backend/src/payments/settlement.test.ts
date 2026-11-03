import { describe, it, expect } from "vitest";
import { planPairSettlement, OpenShare } from "./settlement";

let seq = 0;
function share(debtorId: string, creditorId: string, amount: number): OpenShare {
  seq++;
  return { shareId: `s${seq}`, expenseId: `e${seq}`, description: `Tagihan ${seq}`, debtorId, creditorId, amount };
}

describe("planPairSettlement", () => {
  it("utang dua arah dinetting jadi satu transfer selisih", () => {
    const shares = [share("aku", "budi", 50000), share("budi", "aku", 30000)];
    const plan = planPairSettlement(shares, "aku", "budi")!;

    expect(plan.fromUser).toBe("aku");
    expect(plan.toUser).toBe("budi");
    expect(plan.amount).toBe(20000);
    expect(plan.grossFromOwes).toBe(50000);
    expect(plan.grossToOwes).toBe(30000);
    // kedua share (dua arah) ikut tertutup
    expect(plan.allocations.map(a => a.shareId)).toEqual([shares[0].shareId, shares[1].shareId]);
  });

  it("arah transfer dibalik kalau justru lawan yang utang lebih besar", () => {
    const plan = planPairSettlement([share("aku", "budi", 10000), share("budi", "aku", 25000)], "aku", "budi")!;

    expect(plan.fromUser).toBe("budi");
    expect(plan.toUser).toBe("aku");
    expect(plan.amount).toBe(15000);
  });

  it("utang seimbang menghasilkan transfer 0 tapi tetap menutup semua share", () => {
    const plan = planPairSettlement([share("aku", "budi", 30000), share("budi", "aku", 30000)], "aku", "budi")!;

    expect(plan.amount).toBe(0);
    expect(plan.allocations).toHaveLength(2);
  });

  it("share dengan orang ketiga tidak ikut", () => {
    const plan = planPairSettlement(
      [share("aku", "budi", 10000), share("aku", "citra", 99000), share("citra", "budi", 5000)],
      "aku",
      "budi",
    )!;

    expect(plan.amount).toBe(10000);
    expect(plan.allocations).toHaveLength(1);
  });

  it("tidak ada share di antara keduanya -> null", () => {
    expect(planPairSettlement([share("aku", "citra", 1000)], "aku", "budi")).toBeNull();
  });

  it("selisih desimal tetap presisi", () => {
    const plan = planPairSettlement(
      [share("aku", "budi", 0.3), share("budi", "aku", 0.1), share("budi", "aku", 0.1)],
      "aku",
      "budi",
    )!;

    expect(plan.amount).toBe(0.1);
  });
});

/**
 * Tes integrasi alur pelunasan terhadap database Postgres sungguhan (docker compose).
 * Jalankan dengan: npm run test:integration
 * Dilewati otomatis kalau INTEGRATION tidak di-set, supaya `npm test` tetap cepat & tanpa DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import type { AddressInfo } from "net";

const RUN = process.env.INTEGRATION === "1";

describe.skipIf(!RUN)("alur pelunasan (integrasi)", { timeout: 30_000 }, () => {
  let server: Server;
  let base = "";
  const run = Date.now().toString(36);

  type User = { id: string; token: string; name: string };
  let aku: User, budi: User, citra: User;
  let groupId = "";

  async function call(method: string, path: string, token?: string, body?: unknown) {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json as any };
  }

  async function signup(name: string): Promise<User> {
    const email = `${name}-${run}@test.local`;
    const password = "password123";
    const reg = await call("POST", "/auth/register", undefined, { name, email, password, confirmPassword: password });
    expect(reg.status).toBe(201);
    const login = await call("POST", "/auth/login", undefined, { email, password });
    return { id: login.body.user.id, token: login.body.token, name };
  }

  async function expense(payer: User, description: string, shares: [User, number][]) {
    const total = shares.reduce((s, [, a]) => s + a, 0);
    const r = await call("POST", `/groups/${groupId}/expenses`, payer.token, {
      description,
      totalAmount: total,
      expenseDate: new Date().toISOString(),
      shares: shares.map(([u, shareAmount]) => ({ userId: u.id, shareAmount })),
    });
    expect(r.status).toBe(201);
    return r.body.expense;
  }

  const balance = (u: User) => call("GET", `/groups/${groupId}/balance`, u.token).then(r => r.body);

  beforeAll(async () => {
    const { default: app } = await import("../index");
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    aku = await signup("aku");
    budi = await signup("budi");
    citra = await signup("citra");

    const g = await call("POST", "/groups", aku.token, { name: `Tes ${run}` });
    groupId = g.body.group.id;
    for (const u of [budi, citra]) {
      const j = await call("POST", "/groups/join", u.token, { inviteCode: g.body.group.inviteCode });
      expect(j.status).toBe(200);
    }
  }, 60_000);

  afterAll(() => new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve())));

  it("lunasi selisih: satu transfer menutup utang dua arah", async () => {
    // aku utang 50rb ke budi, budi utang 30rb ke aku
    await expense(budi, "Makan", [[aku, 50000], [budi, 50000]]);
    await expense(aku, "Bensin", [[aku, 30000], [budi, 30000]]);

    const preview = await call("GET", `/groups/${groupId}/settle-preview?with=${budi.id}`, aku.token);
    expect(preview.body.plan.amount).toBe(20000);
    expect(preview.body.plan.iPay).toBe(true);

    // budi tidak boleh mengajukan karena justru dia yang menerima
    const wrongSide = await call("POST", "/payments/settle", budi.token, { groupId, counterpartyId: aku.id });
    expect(wrongSide.status).toBe(400);

    const settle = await call("POST", "/payments/settle", aku.token, { groupId, counterpartyId: budi.id, note: "transfer BCA" });
    expect(settle.status).toBe(201);
    expect(settle.body.payment.amount).toBe(20000);
    expect(settle.body.payment.kind).toBe("settlement");
    expect(settle.body.payment.items).toHaveLength(2);

    // pengajuan kedua untuk share yang sama ditolak
    const again = await call("POST", "/payments/settle", aku.token, { groupId, counterpartyId: budi.id });
    expect(again.status).toBe(400);

    const approve = await call("PATCH", `/payments/${settle.body.payment.id}/approve`, budi.token);
    expect(approve.status).toBe(200);

    const b = await balance(aku);
    expect(b.iOwe.find((x: any) => x.userId === budi.id)).toBeUndefined();
    expect(b.owedToMe.find((x: any) => x.userId === budi.id)).toBeUndefined();
  });

  it("race: dua pengajuan bersamaan untuk share yang sama, hanya satu yang lolos", async () => {
    const exp = await expense(citra, "Kopi", [[aku, 15000], [citra, 15000]]);
    const myShare = exp.shares.find((s: any) => s.userId === aku.id);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => call("POST", "/payments", aku.token, { expenseShareId: myShare.id })),
    );
    const statuses = results.map(r => r.status).sort();
    expect(statuses.filter(s => s === 201)).toHaveLength(1);
    expect(statuses.filter(s => s === 409)).toHaveLength(4);
  });

  it("race: approve dan reject bersamaan, hanya satu yang diproses", async () => {
    const exp = await expense(citra, "Parkir", [[budi, 5000], [citra, 5000]]);
    const share = exp.shares.find((s: any) => s.userId === budi.id);
    const created = await call("POST", "/payments", budi.token, { expenseShareId: share.id });
    const id = created.body.payment.id;

    const results = await Promise.all([
      call("PATCH", `/payments/${id}/approve`, citra.token),
      call("PATCH", `/payments/${id}/approve`, citra.token),
      call("PATCH", `/payments/${id}/reject`, citra.token, { rejectionNote: "x" }),
    ]);
    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(results.filter(r => r.status === 409)).toHaveLength(2);
  });

  it("payment yang ditolak membebaskan share untuk diajukan ulang", async () => {
    const exp = await expense(budi, "Tiket", [[citra, 20000], [budi, 20000]]);
    const share = exp.shares.find((s: any) => s.userId === citra.id);

    const first = await call("POST", "/payments", citra.token, { expenseShareId: share.id });
    const rej = await call("PATCH", `/payments/${first.body.payment.id}/reject`, budi.token, { rejectionNote: "belum masuk" });
    expect(rej.status).toBe(200);

    const second = await call("POST", "/payments", citra.token, { expenseShareId: share.id });
    expect(second.status).toBe(201);
  });

  it("hanya penerima yang boleh approve", async () => {
    const exp = await expense(aku, "Snack", [[citra, 7000], [aku, 7000]]);
    const share = exp.shares.find((s: any) => s.userId === citra.id);
    const created = await call("POST", "/payments", citra.token, { expenseShareId: share.id });

    const byOther = await call("PATCH", `/payments/${created.body.payment.id}/approve`, budi.token);
    expect(byOther.status).toBe(403);
  });

  it("tagihan dengan pengajuan pending tidak bisa dihapus", async () => {
    const exp = await expense(aku, "Galon", [[budi, 4000], [aku, 4000]]);
    const share = exp.shares.find((s: any) => s.userId === budi.id);
    await call("POST", "/payments", budi.token, { expenseShareId: share.id });

    const del = await call("DELETE", `/expenses/${exp.id}`, aku.token);
    expect(del.status).toBe(409);
  });

  it("settlement plan grup tidak lebih banyak transfer dari utang langsung", async () => {
    const plan = await call("GET", `/groups/${groupId}/settlement-plan`, aku.token);
    expect(plan.status).toBe(200);
    expect(plan.body.transfers.length).toBeLessThanOrEqual(plan.body.directTransferCount);
  });
});

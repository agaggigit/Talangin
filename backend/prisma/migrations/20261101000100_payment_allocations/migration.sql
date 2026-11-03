-- Satu payment kini bisa menutup banyak share (settle up).
-- Relasi payments.expense_share_id dipindah ke tabel payment_allocations.

-- 1. Tabel alokasi
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "expense_share_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");
CREATE INDEX "payment_allocations_expense_share_id_idx" ON "payment_allocations"("expense_share_id");
CREATE INDEX "payments_to_user_status_idx" ON "payments"("to_user", "status");

ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_expense_share_id_fkey" FOREIGN KEY ("expense_share_id") REFERENCES "expense_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Pindahkan data lama: setiap payment lama = satu alokasi penuh ke share-nya.
INSERT INTO "payment_allocations" ("payment_id", "expense_share_id", "amount", "active")
SELECT "id", "expense_share_id", "amount", "status" <> 'rejected'
FROM "payments";

-- 3. Bersihkan duplikat yang mungkin lahir dari race condition lama
--    (dua payment aktif untuk share yang sama). Pertahankan yang approved / paling awal.
WITH ranked AS (
    SELECT a."id", a."payment_id",
           ROW_NUMBER() OVER (
               PARTITION BY a."expense_share_id"
               ORDER BY (p."status" = 'approved') DESC, p."submitted_at" ASC
           ) AS rn
    FROM "payment_allocations" a
    JOIN "payments" p ON p."id" = a."payment_id"
    WHERE a."active"
), dupes AS (
    UPDATE "payment_allocations" SET "active" = false
    WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1)
    RETURNING "payment_id"
)
UPDATE "payments"
SET "status" = 'rejected', "reviewed_at" = NOW(), "rejection_note" = 'Pengajuan ganda, dibersihkan otomatis'
WHERE "id" IN (SELECT "payment_id" FROM dupes) AND "status" = 'pending';

-- 4. Invariant: satu share maksimal punya satu alokasi aktif (pending/approved).
--    Ini yang menutup race condition "dua pengajuan bersamaan untuk share yang sama".
--    Prisma belum bisa mendeklarasikan partial index, jadi index ini hanya ada di SQL.
CREATE UNIQUE INDEX "payment_allocations_active_share_key"
    ON "payment_allocations"("expense_share_id") WHERE "active";

-- 5. Kolom lama tidak dipakai lagi
ALTER TABLE "payments" DROP CONSTRAINT "payments_expense_share_id_fkey";
ALTER TABLE "payments" DROP COLUMN "expense_share_id";

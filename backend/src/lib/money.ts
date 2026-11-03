// Semua perhitungan uang dilakukan dalam satuan sen (integer) supaya bebas dari
// error floating point (0.1 + 0.2 !== 0.3). Konversi ke rupiah hanya di batas keluar.

/** Rupiah (number / Prisma Decimal / string) -> sen (integer). */
export function toCents(value: number | string | { toString(): string }): number {
    return Math.round(Number(value.toString()) * 100);
}

/** Sen (integer) -> rupiah (number dengan maks. 2 desimal). */
export function fromCents(cents: number): number {
    return cents / 100;
}

type ShareWithAllocations = { allocations: { payment: unknown }[] };

/**
 * Ubah `share.allocations[].payment` menjadi `share.payments[]` agar bentuk respons API
 * tetap sama seperti sebelum ada tabel alokasi (frontend membaca share.payments[0].status).
 */
export function latestPaymentPerShare<S extends ShareWithAllocations, E extends { shares: S[] }>(expense: E) {
    return {
        ...expense,
        shares: expense.shares.map(({ allocations, ...share }) => ({
            ...share,
            payments: allocations.map(a => a.payment),
        })),
    };
}

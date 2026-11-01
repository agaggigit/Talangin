export const formatRupiah = (value: number | string) =>
    `Rp ${Number(value).toLocaleString('id-ID')}`;

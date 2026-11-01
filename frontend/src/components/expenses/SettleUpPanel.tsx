import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeftRight, Clock, HandCoins, Wallet } from 'lucide-react';
import { Button } from '../Button';
import { useExpenses } from '../../hooks/useExpenses';
import { formatRupiah } from '../../utils/format';
import { getErrorMessage } from '../../utils/errorHandler';

interface SettleUpPanelProps {
    groupId: string;
    counterpartyId: string;
    onSettled?: () => void;
}

/**
 * Aksi pelunasan dengan satu orang. Semua tagihan terbuka di antara kalian
 * (dua arah) ditutup oleh SATU transfer sebesar selisihnya.
 * - Utang dua arah  -> "Lunasi Selisih" + rincian pemotongan
 * - Utang satu arah -> "Bayar Semua ke X" tanpa rincian pemotongan
 * - Kalau dia yang harus bayar -> hanya info, tanpa tombol
 */
export function SettleUpPanel({ groupId, counterpartyId, onSettled }: SettleUpPanelProps) {
    const [note, setNote] = useState('');
    const { useSettlePreview, useSettleUp } = useExpenses();
    const { data, isLoading } = useSettlePreview(groupId, counterpartyId);

    const settleMutation = useSettleUp({
        onSuccess: () => {
            toast.success('Pengajuan pelunasan terkirim!');
            setNote('');
            onSettled?.();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    if (isLoading || !data) return null;

    const { plan, counterparty } = data;
    const name = counterparty.name;

    if (!plan) {
        return data.pendingCount > 0 ? (
            <p className="mt-6 m-0 p-4 rounded-lg bg-[#fef3c7] text-[#92400e] text-[0.9rem] flex items-center gap-2">
                <Clock size={16} className="shrink-0" /> Semua tagihan dengan {name} sedang menunggu konfirmasi.
            </p>
        ) : null;
    }

    const twoWay = plan.grossToOwes > 0;
    const canSubmit = plan.iPay || plan.amount === 0;

    return (
        <div className="mt-6 p-5 rounded-xl border border-primary/40 bg-surface-muted">
            <h4 className="m-0 mb-3 flex items-center gap-2 text-primary">
                {twoWay
                    ? <><ArrowLeftRight size={18} /> Lunasi Selisih</>
                    : <><Wallet size={18} /> {plan.iPay ? `Bayar Semua ke ${name}` : `Tagihan ke ${name}`}</>}
            </h4>

            <div className="text-[0.9rem] flex flex-col gap-1 mb-4">
                {twoWay && (
                    <>
                        <div className="flex justify-between">
                            <span className="text-text-muted">{canSubmit ? 'Utangmu' : `Utang ${name}`}</span>
                            <span>{formatRupiah(plan.grossFromOwes)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">{canSubmit ? `Utang ${name}` : 'Utangmu'}</span>
                            <span>−{formatRupiah(plan.grossToOwes)}</span>
                        </div>
                    </>
                )}
                <div className={`flex justify-between font-bold ${twoWay ? 'border-t border-border pt-2 mt-1' : ''}`}>
                    <span>{plan.amount === 0 ? 'Saling impas' : plan.iPay ? `Kamu transfer ke ${name}` : `${name} transfer ke kamu`}</span>
                    <span className={plan.iPay ? 'text-error' : 'text-success-text'}>{formatRupiah(plan.amount)}</span>
                </div>
                <p className="m-0 mt-1 text-[0.8rem] text-text-muted">
                    {canSubmit
                        ? `${plan.allocations.length} tagihan jadi lunas setelah ${name} mengonfirmasi.`
                        : `${name} yang mengajukan pembayarannya. Kamu akan dapat notifikasi untuk mengonfirmasi.`}
                </p>
            </div>

            {canSubmit && (
                <>
                    <textarea
                        className="w-full p-3 rounded-lg border border-border mb-3 resize-y bg-surface-hover text-text-main focus:border-primary outline-none text-sm"
                        rows={2}
                        placeholder={plan.amount === 0 ? 'Catatan (opsional)' : 'Misal: Sudah transfer via BCA'}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                    <Button
                        fullWidth
                        disabled={settleMutation.isPending}
                        onClick={() => settleMutation.mutate({ groupId, counterpartyId, note })}
                    >
                        <HandCoins size={18} />
                        {settleMutation.isPending ? 'Mengirim...' : plan.amount === 0 ? 'Tandai Impas' : `Sudah Transfer ${formatRupiah(plan.amount)}`}
                    </Button>
                </>
            )}
        </div>
    );
}

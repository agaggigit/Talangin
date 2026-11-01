import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeftRight, Clock, HandCoins } from 'lucide-react';
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
 * "Lunasi selisih" dengan satu orang: semua utang dua arah dinetting,
 * lalu cukup satu transfer sebesar selisihnya.
 */
export function SettleUpPanel({ groupId, counterpartyId, onSettled }: SettleUpPanelProps) {
    const [note, setNote] = useState('');
    const { useSettlePreview, useSettleUp } = useExpenses();
    const { data, isLoading } = useSettlePreview(groupId, counterpartyId);

    const settleMutation = useSettleUp({
        onSuccess: () => {
            toast.success('Pengajuan pelunasan selisih terkirim!');
            setNote('');
            onSettled?.();
        },
        onError: (err) => {
            toast.error(getErrorMessage(err));
        }
    });

    if (isLoading || !data) return null;

    const { plan, counterparty, pendingCount } = data;
    const name = counterparty.name;

    return (
        <div className="mt-6 p-5 rounded-xl border border-primary/40 bg-surface-muted">
            <h4 className="m-0 mb-3 flex items-center gap-2 text-primary">
                <ArrowLeftRight size={18} /> Lunasi Selisih
            </h4>

            {pendingCount > 0 && (
                <p className="m-0 mb-3 text-[0.85rem] text-text-muted flex items-center gap-2">
                    <Clock size={14} /> Ada {pendingCount} tagihan dengan {name} yang masih menunggu konfirmasi.
                </p>
            )}

            {!plan ? (
                <p className="m-0 text-[0.9rem] text-text-muted">Tidak ada tagihan terbuka lain dengan {name}.</p>
            ) : (
                <>
                    <div className="text-[0.9rem] flex flex-col gap-1 mb-4">
                        <div className="flex justify-between">
                            <span className="text-text-muted">{plan.iPay || plan.amount === 0 ? 'Utangmu' : `Utang ${name}`}</span>
                            <span>{formatRupiah(plan.grossFromOwes)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">{plan.iPay || plan.amount === 0 ? `Utang ${name}` : 'Utangmu'}</span>
                            <span>−{formatRupiah(plan.grossToOwes)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 mt-1 font-bold">
                            <span>{plan.amount === 0 ? 'Saling impas' : plan.iPay ? `Kamu transfer ke ${name}` : `${name} transfer ke kamu`}</span>
                            <span className={plan.iPay ? 'text-error' : 'text-success-text'}>{formatRupiah(plan.amount)}</span>
                        </div>
                        <p className="m-0 mt-1 text-[0.8rem] text-text-muted">
                            {plan.allocations.length} tagihan akan ditandai lunas setelah {plan.iPay || plan.amount === 0 ? name : 'kamu'} mengonfirmasi.
                        </p>
                    </div>

                    {plan.iPay || plan.amount === 0 ? (
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
                                {settleMutation.isPending ? 'Mengirim...' : plan.amount === 0 ? 'Ajukan Impas' : `Sudah Transfer ${formatRupiah(plan.amount)}`}
                            </Button>
                        </>
                    ) : (
                        <p className="m-0 text-[0.85rem] text-text-muted">
                            {name} yang perlu mengajukan pelunasan selisih ini. Kamu akan mendapat notifikasi untuk mengonfirmasi.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

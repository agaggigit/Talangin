import { ArrowRight, Sparkles } from 'lucide-react';
import { useExpenses } from '../../hooks/useExpenses';
import { formatRupiah } from '../../utils/format';

interface SettlementPlanCardProps {
    groupId: string;
    currentUserId: string;
}

/**
 * Saran transfer paling sedikit untuk melunasi semua utang di grup
 * (hasil penyederhanaan utang di backend: GET /groups/:id/settlement-plan).
 */
export function SettlementPlanCard({ groupId, currentUserId }: SettlementPlanCardProps) {
    const { useSettlementPlan } = useExpenses();
    const { data } = useSettlementPlan(groupId);

    if (!data || data.transfers.length === 0) return null;

    const saved = data.directTransferCount - data.transfers.length;

    return (
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm mb-6">
            <h4 className="m-0 mb-1 flex items-center gap-2"><Sparkles size={18} className="text-primary" /> Saran Transfer Grup</h4>
            <p className="m-0 mb-4 text-[0.8rem] text-text-muted">
                Cukup {data.transfers.length} transfer untuk melunasi semua utang di grup ini
                {saved > 0 && <> (hemat {saved} transfer dibanding bayar satu per satu)</>}.
            </p>
            <div className="flex flex-col gap-2">
                {data.transfers.map((t, idx) => {
                    const involvesMe = t.from.id === currentUserId || t.to.id === currentUserId;
                    return (
                        <div
                            key={idx}
                            className={`flex items-center justify-between gap-2 p-3 rounded-lg text-[0.9rem] ${involvesMe ? 'bg-surface-muted border border-primary/40' : 'bg-surface-hover'}`}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold truncate">{t.from.id === currentUserId ? 'Kamu' : t.from.name}</span>
                                <ArrowRight size={14} className="shrink-0 text-text-muted" />
                                <span className="font-semibold truncate">{t.to.id === currentUserId ? 'Kamu' : t.to.name}</span>
                            </span>
                            <span className="font-bold shrink-0">{formatRupiah(t.amount)}</span>
                        </div>
                    );
                })}
            </div>
            <p className="m-0 mt-3 text-[0.75rem] text-text-muted">
                Ini saran ringkasan. Untuk mencatat pelunasan, buka Rincian lalu pilih orangnya dan gunakan "Lunasi Selisih".
            </p>
        </div>
    );
}

import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { SettleUpPanel } from './SettleUpPanel';
import { formatRupiah } from '../../utils/format';
import type { BalanceTransaction, GroupBalance } from '../../types';

interface PersonBalanceDetailProps {
    groupId: string;
    balance: GroupBalance;
    person: { userId: string; name: string };
    onNavigate?: () => void;
    onSettled?: () => void;
}

function BillList({ title, txs, tone, onOpen }: { title: string; txs: BalanceTransaction[]; tone: 'debt' | 'credit'; onOpen: (expenseId: string) => void }) {
    if (txs.length === 0) return null;
    return (
        <div className="mb-5">
            <h5 className="m-0 mb-2 text-[0.85rem] text-text-muted font-semibold">{title}</h5>
            <div className="flex flex-col gap-2">
                {txs.map(tx => (
                    <div
                        key={tx.id}
                        onClick={() => onOpen(tx.id)}
                        className="flex justify-between items-center gap-3 p-3 bg-surface-hover rounded-lg border border-border cursor-pointer hover:border-primary transition-colors"
                    >
                        <span className="min-w-0">
                            <span className="font-bold text-text-main block truncate">{tx.description}</span>
                            {tx.pending && (
                                <span className="inline-flex items-center gap-1 text-[0.75rem] text-[#b45309]"><Clock size={12} /> Menunggu konfirmasi</span>
                            )}
                        </span>
                        <span className={`font-bold shrink-0 ${tone === 'debt' ? 'text-error' : 'text-success-text'}`}>{formatRupiah(tx.amount)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Semua tagihan dengan satu orang, DUA ARAH sekaligus, plus satu aksi pelunasan.
 * Dibuka dari daftar utang maupun piutang hasilnya sama, jadi tidak ada tampilan ganda.
 */
export function PersonBalanceDetail({ groupId, balance, person, onNavigate, onSettled }: PersonBalanceDetailProps) {
    const navigate = useNavigate();
    const iOwe = balance.iOwe.find(b => b.userId === person.userId)?.transactions ?? [];
    const owedToMe = balance.owedToMe.find(b => b.userId === person.userId)?.transactions ?? [];

    const open = (expenseId: string) => {
        onNavigate?.();
        navigate(`/expenses/${expenseId}`);
    };

    return (
        <div>
            <BillList title={`Utangmu ke ${person.name}`} txs={iOwe} tone="debt" onOpen={open} />
            <BillList title={`Utang ${person.name} ke kamu`} txs={owedToMe} tone="credit" onOpen={open} />
            {iOwe.length === 0 && owedToMe.length === 0 && (
                <p className="text-text-muted text-[0.9rem]">Tidak ada tagihan terbuka dengan {person.name}.</p>
            )}
            <SettleUpPanel groupId={groupId} counterpartyId={person.userId} onSettled={onSettled} />
        </div>
    );
}

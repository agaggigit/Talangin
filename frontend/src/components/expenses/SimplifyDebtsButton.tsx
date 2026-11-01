import { useState } from 'react';
import { ArrowRight, Info, Route } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useExpenses } from '../../hooks/useExpenses';
import { formatRupiah } from '../../utils/format';

interface SimplifyDebtsButtonProps {
    groupId: string;
    currentUserId: string;
}

/**
 * Fitur tambahan (pratinjau): transfer paling sedikit untuk melunasi semua utang grup.
 * Belum bisa dicatat sebagai pelunasan; hanya ditampilkan saat user memintanya.
 */
export function SimplifyDebtsButton({ groupId, currentUserId }: SimplifyDebtsButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const { useSettlementPlan } = useExpenses();
    const { data, isLoading } = useSettlementPlan(isOpen ? groupId : undefined);

    const label = (u: { id: string; name: string }) => (u.id === currentUserId ? 'Kamu' : u.name);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-full mb-6 flex items-center justify-center gap-2 bg-transparent border border-border rounded-lg py-2.5 text-[0.9rem] text-text-muted cursor-pointer hover:border-primary hover:text-primary transition-colors"
            >
                <Route size={16} /> Sederhanakan Utang Grup
            </button>

            <Modal
                isOpen={isOpen}
                onClose={() => { setIsOpen(false); setShowInfo(false); }}
                title="Sederhanakan Utang"
            >
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-[0.75rem] font-bold px-2 py-0.5 rounded-full bg-surface-muted text-text-muted">PRATINJAU</span>
                    <button
                        onClick={() => setShowInfo(v => !v)}
                        className="bg-transparent border-none p-0 cursor-pointer text-text-muted hover:text-primary flex"
                        aria-label="Apa ini?"
                    >
                        <Info size={18} />
                    </button>
                </div>

                {showInfo && (
                    <p className="m-0 mb-4 p-3 rounded-lg bg-surface-muted text-[0.85rem] text-text-muted">
                        Semua utang di grup dijumlahkan jadi saldo bersih per orang, lalu dicari jumlah transfer paling sedikit
                        supaya semua impas. Contoh: A utang ke B dan B utang ke C, cukup A transfer ke C.
                        Saat ini hanya pratinjau dan belum bisa dicatat sebagai pelunasan.
                    </p>
                )}

                {isLoading || !data ? (
                    <p className="text-text-muted text-center">Menghitung...</p>
                ) : data.transfers.length === 0 ? (
                    <p className="text-text-muted text-center">Semua sudah impas.</p>
                ) : (
                    <>
                        <div className="flex flex-col gap-2">
                            {data.transfers.map((t, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-surface-hover text-[0.9rem]">
                                    <span className="flex items-center gap-2 min-w-0">
                                        <span className="font-semibold truncate">{label(t.from)}</span>
                                        <ArrowRight size={14} className="shrink-0 text-text-muted" />
                                        <span className="font-semibold truncate">{label(t.to)}</span>
                                    </span>
                                    <span className="font-bold shrink-0">{formatRupiah(t.amount)}</span>
                                </div>
                            ))}
                        </div>
                        <p className="m-0 mt-3 text-[0.8rem] text-text-muted text-center">
                            {data.transfers.length} transfer, dibanding {data.directTransferCount} kalau dibayar satu per satu.
                        </p>
                    </>
                )}
            </Modal>
        </>
    );
}

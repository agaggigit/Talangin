import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

interface ParticipantItemProps {
    name: string;
    email: string;
    shareAmount: string;
    isPaid: boolean;
    isCurrentUser: boolean;
    isPayer: boolean;
    avatarUrl?: string | null;
    payments?: { id: string; status: string; note?: string }[];
    /** true hanya kalau user yang login adalah penerima pengajuan pending pada share ini */
    showReviewButton?: boolean;
    onReviewClick?: (paymentId: string) => void;
}

export function ParticipantItem({ name, email, shareAmount, isPaid, isCurrentUser, isPayer, avatarUrl, payments, showReviewButton, onReviewClick }: ParticipantItemProps) {
    return (
        <div className="flex justify-between items-center p-4 bg-surface rounded-lg shadow-sm border border-border">
            <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <Avatar name={name} imageUrl={avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                    <p className="m-0 font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                        {isCurrentUser && <span className="text-primary font-normal text-[0.85rem] mr-1">(Kamu)</span>} {name}
                    </p>
                    <p className="m-0 text-[0.85rem] text-text-muted whitespace-nowrap overflow-hidden text-ellipsis">{email}</p>
                </div>
            </div>
            <div className="text-right shrink-0">
                <p className="m-0 font-bold">Rp {Number(shareAmount).toLocaleString('id-ID')}</p>
                {isPayer ? (
                    <span className="inline-flex items-center gap-1 mt-1 text-[0.8rem] text-text-muted bg-surface-muted px-2 py-0.5 rounded-full">Ditalangi Sendiri</span>
                ) : isPaid ? (
                    <span className="inline-flex items-center gap-1 mt-1 text-[0.8rem] text-success-text bg-success-bg px-2 py-0.5 rounded-full"><CheckCircle size={12} /> Lunas</span>
                ) : payments && payments.length > 0 && payments[0].status === 'pending' ? (
                    <div className="flex items-center gap-2 mt-1 justify-end">
                        {showReviewButton && onReviewClick && (
                            <button 
                                onClick={() => onReviewClick(payments[0].id)}
                                className="bg-[#eab308] text-white border-none rounded-md px-2.5 py-1 text-[0.75rem] cursor-pointer font-bold hover:brightness-90 transition-all"
                            >
                                Review
                            </button>
                        )}
                        <span className="inline-flex items-center gap-1 text-[0.8rem] text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded-full"><Clock size={12} /> Menunggu ACC</span>
                    </div>
                ) : payments && payments.length > 0 && payments[0].status === 'rejected' ? (
                    <span className="inline-flex items-center gap-1 mt-1 text-[0.8rem] text-error bg-error-bg px-2 py-0.5 rounded-full"><XCircle size={12} /> Ditolak</span>
                ) : (
                    <span className="inline-flex items-center gap-1 mt-1 text-[0.8rem] text-error bg-error-bg px-2 py-0.5 rounded-full"><XCircle size={12} /> Belum Bayar</span>
                )}
            </div>
        </div>
    );
}

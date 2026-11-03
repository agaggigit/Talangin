import { useState } from 'react';
import { Button } from '../Button';
import { X, Check, Clock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import toast from 'react-hot-toast';
import { useExpenses } from '../../hooks/useExpenses';
import { formatRupiah } from '../../utils/format';
import { getErrorMessage } from '../../utils/errorHandler';
import { getToken } from '../../utils/token';
import type { PaymentItem } from '../../types';

interface ReviewPaymentModalProps {
    /** null = modal tertutup */
    paymentId: string | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const getCurrentUserId = (): string => {
    const token = getToken();
    return token ? JSON.parse(atob(token.split('.')[1])).userId : '';
};

function ItemList({ title, items, sign }: { title: string; items: PaymentItem[]; sign: '+' | '-' }) {
    if (items.length === 0) return null;
    return (
        <div>
            <p className="m-0 mb-1 text-text-muted">{title}</p>
            {items.map(i => (
                <div key={i.expenseId} className="flex justify-between gap-4">
                    <span>{i.description}</span>
                    <span className={`font-semibold ${sign === '+' ? 'text-success-text' : 'text-error'}`}>
                        {sign === '-' ? '−' : ''}{formatRupiah(i.amount)}
                    </span>
                </div>
            ))}
        </div>
    );
}

/**
 * Detail satu pengajuan pembayaran.
 * - Penerima (payment.toUser) bisa Terima / Tolak.
 * - Pengirim hanya melihat status & rinciannya.
 * Semua teks ditulis dari sudut pandang user yang sedang login.
 */
export function ReviewPaymentModal({ paymentId, onClose, onSuccess }: ReviewPaymentModalProps) {
    const [rejectionNote, setRejectionNote] = useState('');
    const { useReviewPayment, usePaymentDetail } = useExpenses();
    const { data: payment, isLoading } = usePaymentDetail(paymentId);
    const currentUserId = getCurrentUserId();

    const actionMutation = useReviewPayment(paymentId ?? undefined, {
        onSuccess: () => {
            toast.success('Review berhasil disimpan!');
            setRejectionNote('');
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => {
            toast.error(getErrorMessage(err));
        }
    });

    const handleAction = (action: 'approve' | 'reject') => {
        if (!payment) return;
        if (action === 'reject' && !rejectionNote.trim()) {
            toast.error("Harap masukkan alasan penolakan!");
            return;
        }
        actionMutation.mutate({ action, note: rejectionNote });
    };

    const handleClose = () => {
        setRejectionNote('');
        onClose();
    };

    if (!paymentId) return null;

    const iAmReceiver = payment?.toUser === currentUserId;
    const other = payment ? (iAmReceiver ? payment.from : payment.to) : null;
    const isSettlement = payment?.kind === 'settlement';

    // Dari sudut pandang user yang login
    const theyOweMe = payment?.items.filter(i => i.debtorId !== currentUserId) ?? [];
    const iOweThem = payment?.items.filter(i => i.debtorId === currentUserId) ?? [];

    const title = !payment ? 'Pengajuan Pembayaran'
        : iAmReceiver ? (isSettlement ? 'Review Pelunasan Selisih' : 'Review Pembayaran')
        : (isSettlement ? 'Pelunasan Selisih' : 'Pengajuan Pembayaran');

    return (
        <Modal isOpen onClose={handleClose} title={title} maxWidth="460px">
            {isLoading || !payment || !other ? (
                <p className="text-text-muted text-center">Memuat...</p>
            ) : (
                <>
                    <div className="mb-6">
                        <p className="m-0 mb-1">
                            {iAmReceiver
                                ? <><strong>{payment.from.name}</strong> transfer ke kamu</>
                                : <>Kamu transfer ke <strong>{payment.to.name}</strong></>}
                        </p>
                        <p className="m-0 mb-4 text-2xl font-bold text-primary">{formatRupiah(payment.amount)}</p>

                        <div className="p-4 bg-surface-muted rounded-lg text-sm flex flex-col gap-3">
                            <p className="m-0 font-bold">{isSettlement ? 'Tagihan yang ikut lunas' : 'Untuk tagihan'}</p>
                            <ItemList title={`Utang ${other.name} ke kamu`} items={theyOweMe} sign="+" />
                            <ItemList title={`Utangmu ke ${other.name}`} items={iOweThem} sign="-" />
                        </div>

                        {payment.note && (
                            <div className="mt-4 p-4 bg-surface-muted rounded-lg italic text-sm">
                                "{payment.note}"
                            </div>
                        )}
                    </div>

                    {payment.status !== 'pending' ? (
                        <p className="text-center text-text-muted m-0">
                            Pengajuan ini sudah {payment.status === 'approved' ? 'disetujui' : 'ditolak'}.
                            {payment.rejectionNote && <> Alasan: {payment.rejectionNote}</>}
                        </p>
                    ) : !iAmReceiver ? (
                        <p className="m-0 p-4 rounded-lg bg-[#fef3c7] text-[#92400e] font-bold flex items-center justify-center gap-2">
                            <Clock size={18} /> Menunggu konfirmasi {payment.to.name}
                        </p>
                    ) : (
                        <>
                            <label className="block mb-2 font-bold text-sm">
                                Catatan Penolakan <br/>
                                <span className="font-normal text-xs text-text-muted">(Opsional jika Approve, <span className="text-error">Wajib jika Reject</span>)</span>
                            </label>
                            <textarea
                                className="w-full p-3 rounded-lg border border-border mb-6 font-inherit resize-y bg-surface-hover text-text-main focus:border-primary focus:ring-[3px] focus:ring-primary/15 outline-none transition-all duration-200"
                                rows={2}
                                placeholder="Misal: Uangnya kurang 50rb bos!"
                                value={rejectionNote}
                                onChange={(e) => setRejectionNote(e.target.value)}
                            />

                            <div className="flex gap-4 justify-center">
                                <Button
                                    onClick={() => handleAction('reject')}
                                    disabled={actionMutation.isPending}
                                    className="flex-1 !bg-error hover:!bg-error-hover !border-none !text-white"
                                >
                                    <X size={18} /> Tolak
                                </Button>
                                <Button
                                    onClick={() => handleAction('approve')}
                                    disabled={actionMutation.isPending}
                                    className="flex-1"
                                >
                                    <Check size={18} /> Terima
                                </Button>
                            </div>
                        </>
                    )}
                </>
            )}
        </Modal>
    );
}

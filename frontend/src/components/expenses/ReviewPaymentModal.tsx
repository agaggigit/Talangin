import { useState } from 'react';
import { Button } from '../Button';
import { X, Check, ArrowLeftRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import toast from 'react-hot-toast';
import { useExpenses } from '../../hooks/useExpenses';
import { formatRupiah } from '../../utils/format';
import { getErrorMessage } from '../../utils/errorHandler';

interface ReviewPaymentModalProps {
    /** null = modal tertutup */
    paymentId: string | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export function ReviewPaymentModal({ paymentId, onClose, onSuccess }: ReviewPaymentModalProps) {
    const [rejectionNote, setRejectionNote] = useState('');
    const { useReviewPayment, usePaymentDetail } = useExpenses();
    const { data: payment, isLoading } = usePaymentDetail(paymentId);

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

    const isSettlement = payment?.kind === 'settlement';
    // Dari sudut pandang penerima (yang mereview)
    const theyOweMe = payment?.items.filter(i => i.debtorId === payment.fromUser) ?? [];
    const iOweThem = payment?.items.filter(i => i.debtorId !== payment.fromUser) ?? [];

    return (
        <Modal isOpen onClose={handleClose} title={isSettlement ? "Review Pelunasan Selisih" : "Review Pembayaran"} maxWidth="460px">
            {isLoading || !payment ? (
                <p className="text-text-muted text-center">Memuat...</p>
            ) : (
                <>
                    <div className="mb-6">
                        <p className="m-0 mb-2"><strong>Pengirim:</strong> {payment.from.name}{payment.from.email ? ` (${payment.from.email})` : ''}</p>
                        {payment.group && <p className="m-0 mb-2"><strong>Grup:</strong> {payment.group.name}</p>}
                        <p className="m-0 mb-2"><strong>Nominal transfer:</strong> <span className="text-primary font-bold">{formatRupiah(payment.amount)}</span></p>

                        {isSettlement ? (
                            <div className="mt-4 p-4 bg-surface-muted rounded-lg text-sm flex flex-col gap-3">
                                <p className="m-0 flex items-center gap-2 font-bold"><ArrowLeftRight size={16} /> Tagihan yang ikut lunas</p>
                                {theyOweMe.length > 0 && (
                                    <div>
                                        <p className="m-0 mb-1 text-text-muted">Utang {payment.from.name} ke kamu</p>
                                        {theyOweMe.map(i => (
                                            <div key={i.expenseId} className="flex justify-between"><span>{i.description}</span><span className="text-success-text font-semibold">{formatRupiah(i.amount)}</span></div>
                                        ))}
                                    </div>
                                )}
                                {iOweThem.length > 0 && (
                                    <div>
                                        <p className="m-0 mb-1 text-text-muted">Utangmu ke {payment.from.name} (dipotong)</p>
                                        {iOweThem.map(i => (
                                            <div key={i.expenseId} className="flex justify-between"><span>{i.description}</span><span className="text-error font-semibold">−{formatRupiah(i.amount)}</span></div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="m-0 mb-2"><strong>Untuk:</strong> {payment.items[0]?.description}</p>
                        )}

                        {payment.note && (
                            <div className="mt-4 p-4 bg-surface-muted rounded-lg italic text-sm">
                                "{payment.note}"
                            </div>
                        )}
                    </div>

                    {payment.status !== 'pending' ? (
                        <p className="text-center text-text-muted m-0">Pengajuan ini sudah {payment.status === 'approved' ? 'disetujui' : 'ditolak'}.</p>
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

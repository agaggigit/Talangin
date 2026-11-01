import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { ParticipantItem } from '../components/expenses/ParticipantItem';
import { Clock, AlertTriangle, Calendar, Wallet, Edit2, Trash2 } from 'lucide-react';
import { SkeletonForm } from '../components/ui/Skeleton';
import { ReviewPaymentModal } from '../components/expenses/ReviewPaymentModal';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getErrorMessage } from '../utils/errorHandler';
import { useExpenses } from '../hooks/useExpenses';
import { getToken } from '../utils/token';

const MySwal = withReactContent(Swal);

import { useQueryClient } from '@tanstack/react-query';

export const ExpenseDetail = () => {
    const { id: expenseId } = useParams();
    const navigate = useNavigate();

    const queryClient = useQueryClient();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [paymentNote, setPaymentNote] = useState('');

    const [reviewPaymentId, setReviewPaymentId] = useState<string | null>(null);

    useEffect(() => {
        const token = getToken();
        if (token) {
            setCurrentUserId(JSON.parse(atob(token.split('.')[1])).userId);
        }
    }, []);

    const { useExpenseDetail, useDeleteExpense, useCreatePayment } = useExpenses();
    const { data: expense, isLoading, error: expenseError } = useExpenseDetail(expenseId);

    const errorMsg = expenseError ? getErrorMessage(expenseError) : '';

    const deleteMutation = useDeleteExpense(expenseId, expense?.groupId, {
        onSuccess: () => {
            toast.success('Tagihan berhasil dihapus!');
            navigate(`/groups/${expense?.groupId}/expenses`, { replace: true });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || err.message || 'Gagal menghapus tagihan');
        }
    });

    const handleDelete = async () => {
        const result = await MySwal.fire({
            html: (
                <div className="flex flex-col items-center gap-4 mt-4">
                    <div className="p-4 bg-error-bg rounded-full text-error">
                        <Trash2 size={48} />
                    </div>
                    <h2 className="m-0 text-xl font-bold text-text-main">Hapus Tagihan?</h2>
                    <p className="m-0 text-[0.95rem] text-text-muted">Apakah kamu yakin ingin menghapus tagihan ini? (Tindakan ini tidak bisa dibatalkan)</p>
                </div>
            ),
            showCancelButton: true,
            buttonsStyling: false,
            customClass: {
                confirmButton: 'btn btn-danger',
                cancelButton: 'btn btn-outline',
                actions: 'swal2-actions-custom'
            },
            confirmButtonText: "Ya, Hapus!",
            cancelButtonText: "Batal"
        });

        if (!result.isConfirmed) {
            return;
        }

        deleteMutation.mutate();
    };

    const paymentMutation = useCreatePayment(expenseId, {
        onSuccess: () => {
            toast.success('Pengajuan pelunasan berhasil dikirim!');
            setIsModalOpen(false);
            setPaymentNote('');
            queryClient.invalidateQueries({ queryKey: ['groups', expense?.groupId, 'activity'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || err.message || 'Gagal mengirim pembayaran');
        }
    });

    const handleSubmitPayment = () => {
        const share = expense?.shares.find(s => s.userId === currentUserId);
        if (!share) return;
        paymentMutation.mutate({
            expenseShareId: share.id,
            note: paymentNote,
        });
    };

    // Removed early return for isLoading to keep PageHeader visible
    if (errorMsg) return <div className="pt-8 max-w-[1200px] mx-auto px-6"><p className="text-center mt-8 text-error flex items-center justify-center gap-2"><AlertTriangle size={20} /> {errorMsg}</p></div>;
    if (!isLoading && !expense) return <div className="pt-8 max-w-[1200px] mx-auto px-6"><p className="text-center mt-8">Data tidak ditemukan</p></div>;

    const myShare = expense?.shares.find((s) => s.userId === currentUserId);
    const amIInvolvedAndUnpaid = myShare && !myShare.isPaid && expense?.paidBy !== currentUserId;
    const amIThePayer = expense?.paidBy === currentUserId;
    const hasPaidShares = expense?.shares.some((s) => s.isPaid && s.userId !== expense?.paidBy);
    const myPendingPayment = myShare?.payments?.find((p) => p.status === 'pending');
    // Bisa terjadi pada pelunasan selisih: share-ku ikut dalam transfer yang justru ditujukan ke aku
    const iMustReviewMyShare = myPendingPayment?.toUser === currentUserId;

    return (
        <div className="pt-8 max-w-[1200px] mx-auto px-6 pb-12">
            <PageHeader title="Detail Tagihan" />

            <main className="mt-8 pb-16">
                <div className="bg-surface p-8 rounded-xl border border-border shadow-sm flex flex-col md:flex-row gap-8">
                    
                    {isLoading || !expense ? (
                        <SkeletonForm />
                    ) : (
                        <>
                            {/* KOLOM KIRI: Daftar Anggota Ditalangi */}
                            <div className="flex-[1.2]">
                                <div className="p-6 bg-surface-hover rounded-xl border border-border">
                                    <h3 className="m-0 mb-6 border-b border-border pb-2 text-lg">
                                        Ditalangi oleh: <span className="text-primary">{expense.paidByUser?.name || 'Seseorang'}</span>
                                    </h3>
                                    
                                    <div className="flex flex-col gap-4">
                                        {expense.shares.map(share => (
                                            <ParticipantItem 
                                                key={share.id}
                                                name={share.user?.name || 'Anggota'}
                                                email={share.user?.email || ''}
                                                shareAmount={String(share.shareAmount)}
                                                isPaid={share.isPaid}
                                                isCurrentUser={share.userId === currentUserId}
                                                isPayer={share.userId === expense.paidBy}
                                                payments={share.payments}
                                                showReviewButton={share.payments?.[0]?.status === 'pending' && share.payments[0].toUser === currentUserId}
                                                onReviewClick={(paymentId) => setReviewPaymentId(paymentId)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            {/* KOLOM KANAN: Informasi Tagihan & Tombol */}
                            <div className="flex-1 md:max-w-[400px]">
                                <div>
                                    <h1 className="m-0 text-3xl font-bold">{expense.description}</h1>
                                    <div className="flex justify-between items-center mt-4 mb-8">
                                        <div>
                                            <p className="m-0 text-text-muted">Grup: <strong>{expense.group?.name || 'Grup'}</strong></p>
                                            <p className="m-0 mt-1 text-text-muted flex items-center gap-2">
                                                <Calendar size={16} /> {new Date(expense.expenseDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="m-0 text-[0.9rem] text-text-muted">Total Tagihan</p>
                                            <h2 className="m-0 text-primary">Rp {Number(expense.totalAmount).toLocaleString('id-ID')}</h2>
                                        </div>
                                    </div>
                                </div>

                                {amIInvolvedAndUnpaid && (
                                    <div className="mt-2 flex justify-center">
                                        {myPendingPayment && iMustReviewMyShare ? (
                                            <Button
                                                onClick={() => setReviewPaymentId(myPendingPayment.id)}
                                                className="w-full py-3 px-8 !bg-[#eab308] hover:brightness-90 flex items-center justify-center gap-2"
                                            >
                                                <Clock size={20} /> Tagihan ini ikut pelunasan selisih, review
                                            </Button>
                                        ) : myPendingPayment ? (
                                            <button
                                                onClick={() => setReviewPaymentId(myPendingPayment.id)}
                                                className="py-4 px-8 bg-[#fef3c7] text-[#92400e] rounded-lg border border-[#fde68a] font-bold w-full text-center flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                <Clock size={20} /> Menunggu Konfirmasi {expense?.paidByUser?.name || 'Penombok'}
                                            </button>
                                        ) : (
                                            <Button 
                                                onClick={() => setIsModalOpen(true)} 
                                                className="w-full py-3 px-8 text-[1.05rem] shadow-md flex items-center justify-center gap-2"
                                            >
                                                <Wallet size={20} /> Ajukan Pembayaran ke {expense.paidByUser?.name || 'Penombok'}
                                            </Button>
                                        )}
                                    </div>
                                )}
                                
                                {amIThePayer && (
                                    <div className="mt-2 flex gap-4 justify-center">
                                        <Button 
                                            variant="outline" 
                                            className="flex-1 flex items-center justify-center gap-2"
                                            onClick={() => navigate(`/expenses/${expenseId}/edit`)}
                                        >
                                            <Edit2 size={18} /> Edit Tagihan
                                        </Button>
                                        {!hasPaidShares ? (
                                            <Button 
                                                className="flex-1 bg-error flex items-center justify-center gap-2"
                                                onClick={handleDelete}
                                                disabled={deleteMutation.isPending}
                                            >
                                                {deleteMutation.isPending ? 'Menghapus...' : <><Trash2 size={18} /> Hapus</>}
                                            </Button>
                                        ) : (
                                            <div className="flex-1 p-2 text-[0.8rem] text-text-muted text-center">
                                                (Hapus dimatikan)
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    </div>
                </main>

            {expense && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    title="Ajukan Pembayaran"
                    description={<>Beri tahu <strong>{expense.paidByUser?.name || 'Penombok'}</strong> kalau kamu sudah mentransfer uangnya.</>}
                >
                <label className="block mb-2 font-bold text-[0.9rem]">Catatan (Opsional)</label>
                <textarea 
                    className="w-full p-3 border-[1.5px] border-border rounded-lg text-base bg-surface-hover text-text-main transition-all duration-200 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 mb-6 font-inherit resize-y"
                    rows={3}
                    placeholder="Misal: Udah kutransfer via GoPay ya brok!"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                />
                
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
                    <Button onClick={handleSubmitPayment} disabled={paymentMutation.isPending}>
                        {paymentMutation.isPending ? 'Mengirim...' : 'Kirim Pengajuan'}
                    </Button>
                </div>
                </Modal>
            )}

            <ReviewPaymentModal
                paymentId={reviewPaymentId}
                onClose={() => setReviewPaymentId(null)}
            />
        </div>
    );
};

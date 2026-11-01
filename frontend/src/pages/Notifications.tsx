import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { SkeletonList } from '../components/ui/Skeleton';
import { ReviewPaymentModal } from '../components/expenses/ReviewPaymentModal';
import { Inbox, Check, AlertTriangle, PartyPopper, Info, ArrowLeft } from 'lucide-react';
import { getErrorMessage } from '../utils/errorHandler';
import type { JoinRequest, Notification as NotificationType } from '../types';
import { useNotifications } from '../hooks/useNotifications';

export const Notifications = () => {
    const navigate = useNavigate();
    const { useGeneralNotifs, useJoinRequests, useIncomingPayments, useMarkAsRead, useMarkAllAsRead } = useNotifications();

    const { data: joinRequests = [], isLoading: isLoadingJoin, error: joinError } = useJoinRequests();
    const { data: incomingPayments = [], isLoading: isLoadingPayments, error: paymentError } = useIncomingPayments();
    const { data: generalNotifs = [], isLoading: isLoadingNotifs, error: notifError } = useGeneralNotifs();

    const isLoading = isLoadingJoin || isLoadingPayments || isLoadingNotifs;
    const errorMsg = [joinError, paymentError, notifError].filter(Boolean).map(e => getErrorMessage(e)).join(', ');

    const hasNoNotifications = joinRequests.length === 0 && incomingPayments.length === 0 && generalNotifs.length === 0;

    const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

    // Tandai notifikasi sudah dibaca
    const markAsReadMutation = useMarkAsRead();
    const markAllAsReadMutation = useMarkAllAsRead();

    return (
        <div className="p-8 max-w-[800px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="bg-transparent border-none text-[1.5rem] cursor-pointer p-0 text-primary"
                        title="Kembali"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-[1.5rem] m-0 flex items-center gap-2">Kotak Masuk <Inbox size={24} /></h1>
                </div>
                {generalNotifs.some((n: NotificationType) => !n.isRead) && (
                    <button 
                        onClick={() => markAllAsReadMutation.mutate()} 
                        className="bg-transparent border-none text-primary text-[0.9rem] cursor-pointer font-bold"
                    >
                        <span className="flex items-center gap-1"><Check size={16} /> Tandai Semua Dibaca</span>
                    </button>
                )}
            </div>

            {/* List Pesan */}
            <div className="flex flex-col gap-4">
                {isLoading ? (
                    <SkeletonList count={5} />
                ) : errorMsg ? (
                    <div className="p-4 bg-error-bg text-error rounded-lg text-center flex items-center justify-center gap-2">
                        <AlertTriangle size={20} /> {errorMsg}
                    </div>
                ) : hasNoNotifications ? (
                    <div className="text-center py-12 px-8 bg-surface rounded-lg shadow-sm">
                        <p className="text-text-muted text-[1.1rem] m-0 flex items-center justify-center gap-2">
                            Hore! Belum ada pesan baru saat ini. <PartyPopper size={20} />
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Pengajuan pembayaran yang menunggu review */}
                        {incomingPayments.map((payment) => (
                            <div key={payment.id} className="flex justify-between items-center py-5 px-6 bg-surface-hover rounded-lg border border-yellow-500 shadow-sm transition-all duration-200">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold text-[1.2rem] shadow-sm shrink-0">
                                        {payment.from.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="m-0 text-[1rem]">
                                            <span className="font-semibold text-text-main">{payment.from.name}</span> mengajukan {payment.kind === 'settlement'
                                                ? <>pelunasan selisih untuk <span className="font-semibold">{payment.items.length} tagihan</span></>
                                                : <>pelunasan untuk <span className="font-semibold">{payment.items[0]?.description}</span></>}
                                            {payment.group && <> di <span className="font-semibold">{payment.group.name}</span></>}
                                        </p>
                                        <p className="m-0 text-[0.85rem] text-yellow-800 mt-1 font-bold">
                                            Sebesar Rp {Number(payment.amount).toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <Button onClick={() => setSelectedPaymentId(payment.id)} className="bg-yellow-500 text-white border-none hover:bg-yellow-600">
                                        Review
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {/* Permintaan bergabung ke grup */}
                        {joinRequests.map((notif: JoinRequest & { group: {name: string}, requestedAt: string }) => (
                            <div key={notif.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-5 px-6 bg-surface rounded-lg border border-border shadow-sm transition-all duration-200 gap-4 sm:gap-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[1.2rem] shadow-sm shrink-0">
                                        {notif.user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="m-0 text-[1rem]">
                                            <span className="font-semibold text-text-main">{notif.user.name}</span> ingin bergabung ke sirkel <span className="font-semibold">{notif.group.name}</span>
                                        </p>
                                        <p className="m-0 text-[0.85rem] text-text-muted mt-1">
                                            {new Date(notif.requestedAt).toLocaleDateString('id-ID', { 
                                                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="w-full sm:w-auto">
                                    <Button className="w-full sm:w-auto" onClick={() => navigate(`/groups/${notif.groupId}`)}>
                                        Buka Sirkel
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {/* Notifikasi umum */}
                        {generalNotifs.map((notif: NotificationType) => (
                            <div key={notif.id} 
                                onClick={() => !notif.isRead && markAsReadMutation.mutate(notif.id)}
                                className={`flex items-center gap-4 py-5 px-6 rounded-lg border transition-all duration-200 ${notif.isRead ? 'bg-transparent border-border opacity-70 cursor-default shadow-none' : 'bg-surface-hover border-primary cursor-pointer shadow-sm'}`}
                            >
                                <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center text-[1rem] shrink-0 ${notif.isRead ? 'bg-border' : 'bg-sky-400'}`}>
                                    <Info size={20} />
                                </div>
                                <div>
                                    <p className="m-0 text-[0.95rem] text-text-main">
                                        {notif.message}
                                    </p>
                                    <p className="m-0 text-[0.8rem] text-text-muted mt-1">
                                        {new Date(notif.createdAt).toLocaleDateString('id-ID', { 
                                            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                {!notif.isRead && <div className="ml-auto w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></div>}
                            </div>
                        ))}
                    </>
                )}
            </div>

            <ReviewPaymentModal
                paymentId={selectedPaymentId}
                onClose={() => setSelectedPaymentId(null)}
            />
        </div>
    );
};

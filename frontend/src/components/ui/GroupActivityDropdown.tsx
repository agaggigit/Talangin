import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';
import { getToken } from '../../utils/token';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import type { PaymentSummary } from '../../types';

type ActivityItem = PaymentSummary;


export function GroupActivityDropdown({ groupId }: { groupId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const token = getToken();
    const currentUserId = token ? JSON.parse(atob(token.split('.')[1])).userId : '';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { isLoading } = useQuery({
        queryKey: ['groups', groupId, 'activity'],
        queryFn: async () => {
            const response = await api.get(`/groups/${groupId}/activity`);
            return response.data as ActivityItem[];
        },
        enabled: isOpen // Only fetch when dropdown is open, or maybe always fetch to show red dot?
    });

    // Let's always fetch to show the red dot if there are pending actions for me
    const { data: allActivities } = useQuery({
        queryKey: ['groups', groupId, 'activity', 'all'],
        queryFn: async () => {
            const response = await api.get(`/groups/${groupId}/activity`);
            return response.data as ActivityItem[];
        }
    });

    const hasPendingForMe = allActivities?.some(a => a.status === 'pending' && a.to.id === currentUserId) || false;

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="bg-transparent border-none cursor-pointer relative p-2 flex items-center justify-center text-primary rounded-full transition-colors duration-200 hover:bg-surface-muted"
            >
                <Bell size={24} />
                {hasPendingForMe && (
                    <span className="absolute top-1 right-[6px] w-2.5 h-2.5 bg-error rounded-full border-2 border-dashboard-bg"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-[320px] bg-surface rounded-xl shadow-lg border border-border z-[100] max-h-[400px] overflow-y-auto">
                    <div className="p-4 border-b border-border flex justify-between items-center">
                        <h3 className="m-0 text-[1rem]">Aktivitas Grup</h3>
                    </div>
                    <div className="flex flex-col">
                        {isLoading || !allActivities ? (
                            <div className="p-4 text-center text-text-muted">Memuat...</div>
                        ) : allActivities.length === 0 ? (
                            <div className="py-6 px-4 text-center text-text-muted">Belum ada aktivitas.</div>
                        ) : (
                            allActivities.map(activity => {
                                const isForMe = activity.to.id === currentUserId;
                                const isFromMe = activity.from.id === currentUserId;
                                let statusIcon, statusColor, actionText;

                                if (activity.status === 'pending') {
                                    statusIcon = <Clock size={16} />;
                                    statusColor = '#b45309';
                                    if (isForMe) actionText = `${activity.from.name} mengajukan pelunasan kepadamu`;
                                    else if (isFromMe) actionText = `Kamu mengajukan pelunasan ke ${activity.to.name}`;
                                    else actionText = `${activity.from.name} mengajukan pelunasan ke ${activity.to.name}`;
                                } else if (activity.status === 'approved') {
                                    statusIcon = <CheckCircle size={16} />;
                                    statusColor = 'rgb(var(--color-success-text))';
                                    if (isForMe) actionText = `Kamu mengkonfirmasi pelunasan ${activity.from.name}`;
                                    else if (isFromMe) actionText = `${activity.to.name} mengkonfirmasi pelunasanmu`;
                                    else actionText = `${activity.to.name} mengkonfirmasi pelunasan ${activity.from.name}`;
                                } else {
                                    statusIcon = <XCircle size={16} />;
                                    statusColor = 'rgb(var(--color-error))';
                                    if (isForMe) actionText = `Kamu menolak pelunasan ${activity.from.name}`;
                                    else if (isFromMe) actionText = `${activity.to.name} menolak pelunasanmu`;
                                    else actionText = `${activity.to.name} menolak pelunasan ${activity.from.name}`;
                                }

                                return (
                                    <div 
                                        key={activity.id} 
                                        onClick={() => {
                                            setIsOpen(false);
                                            // Pelunasan satu tagihan -> buka tagihannya; pelunasan selisih -> tetap di grup
                                            if (activity.kind === 'single' && activity.items[0]) {
                                                navigate(`/expenses/${activity.items[0].expenseId}`);
                                            }
                                        }}
                                        className={`p-4 border-b border-border cursor-pointer transition-colors duration-200 flex gap-3 hover:bg-surface-muted ${activity.status === 'pending' && isForMe ? 'bg-surface-muted' : 'bg-transparent'}`}
                                    >
                                        <div className="mt-[2px]" style={{ color: statusColor }}>
                                            {statusIcon}
                                        </div>
                                        <div className="flex-1">
                                            <p className="m-0 text-[0.9rem] text-text-main leading-snug">
                                                {actionText} {activity.kind === 'settlement'
                                                    ? <>(selisih dari <strong>{activity.items.length} tagihan</strong>)</>
                                                    : <>untuk tagihan <strong>{activity.items[0]?.description}</strong></>}
                                            </p>
                                            <p className="m-0 text-[0.75rem] text-text-muted mt-1">
                                                Rp {Number(activity.amount).toLocaleString('id-ID')} • {new Date(activity.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <ArrowRight size={16} className="text-text-muted self-center" />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

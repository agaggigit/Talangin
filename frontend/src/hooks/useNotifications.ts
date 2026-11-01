import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Notification, JoinRequest, PaymentSummary } from '../types';

export const useNotifications = () => {
    const queryClient = useQueryClient();

    // 1. Ambil Notifikasi Umum
    const useGeneralNotifs = () => {
        return useQuery({
            queryKey: ['notifications', 'general'],
            queryFn: async () => {
                const response = await api.get('/notifications');
                return response.data as Notification[];
            }
        });
    };

    // 2. Ambil Join Requests
    const useJoinRequests = () => {
        return useQuery({
            queryKey: ['notifications', 'join-requests'],
            queryFn: async () => {
                const response = await api.get('/notifications/join-requests');
                return response.data as (JoinRequest & { group: {name: string}, requestedAt: string })[];
            }
        });
    };

    // 3. Ambil Incoming Payments
    const useIncomingPayments = () => {
        return useQuery({
            queryKey: ['payments', 'incoming'],
            queryFn: async () => {
                const response = await api.get('/payments/incoming');
                return response.data as PaymentSummary[];
            }
        });
    };

    // 4. Mark As Read (Satu)
    const useMarkAsRead = () => {
        return useMutation({
            mutationFn: async (id: string) => {
                await api.patch(`/notifications/${id}/read`);
            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['notifications', 'general'] });
            }
        });
    };

    // 5. Mark All As Read
    const useMarkAllAsRead = () => {
        return useMutation({
            mutationFn: async () => {
                await api.patch(`/notifications/read-all`);
            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['notifications', 'general'] });
            }
        });
    };

    return {
        useGeneralNotifs,
        useJoinRequests,
        useIncomingPayments,
        useMarkAsRead,
        useMarkAllAsRead
    };
};

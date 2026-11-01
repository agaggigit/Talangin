import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Expense, PaymentSummary, SettlePreview, SettlementPlan } from '../types';

export const useExpenses = () => {
    const queryClient = useQueryClient();

    // 1. Ambil Balance Grup
    const useGroupBalance = (groupId: string | undefined) => {
        return useQuery({
            queryKey: ['groups', groupId, 'balance'],
            queryFn: async () => {
                const response = await api.get(`/groups/${groupId}/balance`);
                return response.data;
            },
            enabled: !!groupId
        });
    };

    // 2. Infinite Query Daftar Tagihan
    const useInfiniteExpenses = (groupId: string | undefined, searchKeyword: string, startDate: string, endDate: string, filterType: string) => {
        return useInfiniteQuery({
            queryKey: ['groups', groupId, 'expenses', searchKeyword, startDate, endDate, filterType],
            queryFn: async ({ pageParam = 1 }) => {
                let url = `/groups/${groupId}/expenses?page=${pageParam}&limit=10`;
                if (searchKeyword) url += `&keyword=${encodeURIComponent(searchKeyword)}`;
                if (startDate) url += `&startDate=${startDate}`;
                if (endDate) url += `&endDate=${endDate}`;
                if (filterType !== 'all') url += `&filterType=${filterType}`;

                const response = await api.get(url);
                return response.data as Expense[];
            },
            getNextPageParam: (lastPage, allPages) => {
                return lastPage.length === 10 ? allPages.length + 1 : undefined;
            },
            initialPageParam: 1,
            enabled: !!groupId
        });
    };

    // 3. Detail Tagihan
    const useExpenseDetail = (expenseId: string | undefined) => {
        return useQuery({
            queryKey: ['expenses', expenseId],
            queryFn: async () => {
                const response = await api.get(`/expenses/${expenseId}`);
                return response.data as Expense;
            },
            enabled: !!expenseId
        });
    };

    // 4. Buat Tagihan Baru
    const useCreateExpense = (groupId: string | undefined, options?: { onSuccess?: (data: any) => void, onError?: (err: unknown) => void }) => {
        return useMutation({
            mutationFn: async (payload: { description: string, totalAmount: number, expenseDate: string, shares: { userId: string, shareAmount: number }[] }) => {
                const response = await api.post(`/groups/${groupId}/expenses`, payload);
                return response.data;
            },
            onSuccess: (data) => {
                queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'expenses'] });
                queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balance'] });
                if (options?.onSuccess) options.onSuccess(data);
            },
            onError: (err) => {
                if (options?.onError) options.onError(err);
            }
        });
    };

    // 5. Edit Tagihan
    const useEditExpense = (expenseId: string | undefined, groupId: string | undefined, options?: { onSuccess?: (data: any) => void, onError?: (err: unknown) => void }) => {
        return useMutation({
            mutationFn: async (payload: { description: string, totalAmount: number, expenseDate: string, shares: { userId: string, shareAmount: number }[] }) => {
                const response = await api.patch(`/expenses/${expenseId}`, payload);
                return response.data;
            },
            onSuccess: (data) => {
                queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'expenses'] });
                queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balance'] });
                queryClient.invalidateQueries({ queryKey: ['expenses', expenseId] });
                if (options?.onSuccess) options.onSuccess(data);
            },
            onError: (err) => {
                if (options?.onError) options.onError(err);
            }
        });
    };

    // 6. Hapus Tagihan
    const useDeleteExpense = (expenseId: string | undefined, groupId: string | undefined, options?: { onSuccess?: () => void, onError?: (err: unknown) => void }) => {
        return useMutation({
            mutationFn: async () => {
                const response = await api.delete(`/expenses/${expenseId}`);
                return response.data;
            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'expenses'] });
                queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balance'] });
                if (options?.onSuccess) options.onSuccess();
            },
            onError: (err) => {
                if (options?.onError) options.onError(err);
            }
        });
    };

    // 7. Bayar Tagihan (Create Payment)
    const useCreatePayment = (expenseId: string | undefined, options?: { onSuccess?: (data: any) => void, onError?: (err: unknown) => void }) => {
        return useMutation({
            mutationFn: async (payload: { expenseShareId: string, note?: string }) => {
                const response = await api.post(`/payments`, payload);
                return response.data;
            },
            onSuccess: (data) => {
                queryClient.invalidateQueries({ queryKey: ['expenses', expenseId] });
                queryClient.invalidateQueries({ queryKey: ['groups'] });
                if (options?.onSuccess) options.onSuccess(data);
            },
            onError: (err) => {
                if (options?.onError) options.onError(err);
            }
        });
    };

    // Data yang berubah setiap kali ada pembayaran dibuat / direview
    const invalidatePaymentData = () => {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['groups'] });
        queryClient.invalidateQueries({ queryKey: ['payments'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    // 8. Terima/Tolak Pembayaran (Review Payment)
    const useReviewPayment = (paymentId: string | undefined, options?: { onSuccess?: (data: any) => void, onError?: (err: unknown) => void }) => {
        return useMutation({
            mutationFn: async ({ action, note }: { action: 'approve' | 'reject', note?: string }) => {
                const payload = action === 'reject' ? { rejectionNote: note } : {};
                const response = await api.patch(`/payments/${paymentId}/${action}`, payload);
                return response.data;
            },
            onSuccess: (data) => {
                invalidatePaymentData();
                if (options?.onSuccess) options.onSuccess(data);
            },
            onError: (err) => {
                if (options?.onError) options.onError(err);
            }
        });
    };

    // 9. Detail satu pembayaran
    const usePaymentDetail = (paymentId: string | null | undefined) => {
        return useQuery({
            queryKey: ['payments', paymentId],
            queryFn: async () => {
                const response = await api.get(`/payments/${paymentId}`);
                return response.data as PaymentSummary;
            },
            enabled: !!paymentId
        });
    };

    // 10. Pratinjau "lunasi selisih" dengan satu orang
    const useSettlePreview = (groupId: string | undefined, counterpartyId: string | null | undefined) => {
        return useQuery({
            queryKey: ['groups', groupId, 'settle-preview', counterpartyId],
            queryFn: async () => {
                const response = await api.get(`/groups/${groupId}/settle-preview`, { params: { with: counterpartyId } });
                return response.data as SettlePreview;
            },
            enabled: !!groupId && !!counterpartyId
        });
    };

    // 11. Ajukan pelunasan selisih
    const useSettleUp = (options?: { onSuccess?: (data: any) => void, onError?: (err: unknown) => void }) => {
        return useMutation({
            mutationFn: async (payload: { groupId: string, counterpartyId: string, note?: string }) => {
                const response = await api.post(`/payments/settle`, payload);
                return response.data;
            },
            onSuccess: (data) => {
                invalidatePaymentData();
                if (options?.onSuccess) options.onSuccess(data);
            },
            onError: (err) => {
                if (options?.onError) options.onError(err);
            }
        });
    };

    // 12. Saran transfer minimal untuk seluruh grup
    const useSettlementPlan = (groupId: string | undefined) => {
        return useQuery({
            queryKey: ['groups', groupId, 'settlement-plan'],
            queryFn: async () => {
                const response = await api.get(`/groups/${groupId}/settlement-plan`);
                return response.data as SettlementPlan;
            },
            enabled: !!groupId
        });
    };

    return {
        useGroupBalance,
        useInfiniteExpenses,
        useExpenseDetail,
        useCreateExpense,
        useEditExpense,
        useDeleteExpense,
        useCreatePayment,
        useReviewPayment,
        usePaymentDetail,
        useSettlePreview,
        useSettleUp,
        useSettlementPlan
    };
};

import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ExpenseCard } from '../components/expenses/ExpenseCard';
import { SettleUpPanel } from '../components/expenses/SettleUpPanel';
import { SettlementPlanCard } from '../components/expenses/SettlementPlanCard';
import { Modal } from '../components/ui/Modal';
import { Settings, Search, Plus, AlertTriangle, Receipt, Filter, ArrowRight, Wallet, PartyPopper, ArrowLeft } from 'lucide-react';
import { getErrorMessage } from '../utils/errorHandler';

import { SkeletonList } from '../components/ui/Skeleton';
import { GroupActivityDropdown } from '../components/ui/GroupActivityDropdown';
import { useExpenses } from '../hooks/useExpenses';
import { getToken } from '../utils/token';

const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return "Hari Ini";
    if (date.toDateString() === yesterday.toDateString()) return "Kemarin";
    
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const GroupExpenses = () => {
    const { id: groupId } = useParams();
    const navigate = useNavigate();

    const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
    const [selectedBalanceDetail, setSelectedBalanceDetail] = useState<{ userId: string, name: string, amount: number, transactions: { id: string, description: string, amount: number, iOweThem: boolean }[], isDebt: boolean } | null>(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
    const [isClosingSheet, setIsClosingSheet] = useState(false);

    const token = getToken();
    const currentUserId = token ? JSON.parse(atob(token.split('.')[1])).userId : '';

    const applyFilters = () => {
        closeFilterSheet();
    };

    const closeFilterSheet = () => {
        setIsClosingSheet(true);
        setTimeout(() => {
            setIsFilterSheetOpen(false);
            setIsClosingSheet(false);
        }, 300);
    };

    const { useGroupBalance, useInfiniteExpenses } = useExpenses();
    const { data: balanceData, isLoading: isBalanceLoading } = useGroupBalance(groupId);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error
    } = useInfiniteExpenses(groupId, searchKeyword, startDate, endDate, filterType);

    const expenses = data ? data.pages.flatMap(page => page) : [];
    const errorMsg = isError ? getErrorMessage(error) : '';

    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (isLoading || isFetchingNextPage) return; 
        if (observer.current) observer.current.disconnect(); 
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        });
        
        if (node) observer.current.observe(node);
    }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

    return (
        <div className="pt-8 max-w-[1200px] mx-auto px-6 pb-12">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr] lg:items-start">
                <div className="flex flex-col">
                    <PageHeader 
                        title="Riwayat Tagihan" 
                        onBack={() => navigate('/dashboard')}
                        action={
                            <div className="flex items-center gap-2">
                                <GroupActivityDropdown groupId={groupId || ''} />
                                <button 
                                    onClick={() => navigate(`/groups/${groupId}`)}
                                    className="bg-transparent border-none cursor-pointer p-2 text-primary flex items-center justify-center rounded-full hover:bg-surface-muted transition-colors"
                                    title="Pengaturan Sirkel"
                                >
                                    <Settings size={24} />
                                </button>
                            </div>
                        }
                    />

                {/* --- BAR PENCARIAN & FILTER --- */}
                <div className="flex gap-2 w-full mb-4">
                    <div className="flex-1 relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                            <Search size={18} />
                        </span>
                        <input 
                            type="text" 
                            className="p-3 w-full !pl-[2.75rem] rounded-lg border-[1.5px] border-border bg-surface-hover text-text-main transition-all duration-200 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15" 
                            placeholder="Cari tagihan (cth: Nasi Padang)..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                        />
                    </div>
                    <Button variant="outline" onClick={() => setIsFilterSheetOpen(true)} className="px-4 py-2 flex items-center gap-2">
                        <Filter size={18} />
                        <span>Filter</span>
                        {(startDate || endDate || filterType !== 'all') && (
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                        )}
                    </Button>
                </div>

                {/* --- INDIKATOR FILTER AKTIF --- */}
                {(startDate || endDate || filterType !== 'all') && (
                    <div className="flex gap-2 flex-wrap w-full mb-4">
                        {startDate && <span className="bg-[#e0f2fe] text-[#0369a1] px-3 py-1 rounded-full text-xs font-bold">Mulai: {new Date(startDate).toLocaleDateString('id-ID')}</span>}
                        {endDate && <span className="bg-[#e0f2fe] text-[#0369a1] px-3 py-1 rounded-full text-xs font-bold">Hingga: {new Date(endDate).toLocaleDateString('id-ID')}</span>}
                        {filterType === 'involved' && <span className="bg-[#fef3c7] text-[#b45309] px-3 py-1 rounded-full text-xs font-bold">Status: Terlibat</span>}
                        {filterType === 'unpaid' && <span className="bg-error-bg text-error px-3 py-1 rounded-full text-xs font-bold">Status: Belum Lunas</span>}
                        {filterType === 'payer' && <span className="bg-success-bg text-success-text px-3 py-1 rounded-full text-xs font-bold">Status: Nalangin</span>}
                        <span 
                            onClick={() => { setSearchKeyword(''); setStartDate(''); setEndDate(''); setFilterType('all'); }}
                            className="text-text-muted text-xs underline cursor-pointer p-1 hover:text-text-main transition-colors"
                        >Hapus Semua Filter</span>
                    </div>
                )}
                    <main className="flex flex-col mt-2">
                        {errorMsg && (
                            <div className="p-4 bg-error-bg text-error rounded-lg mb-6 flex items-center gap-2">
                                <AlertTriangle size={20} /> {errorMsg}
                            </div>
                        )}

                        {isLoading ? (
                            <SkeletonList count={4} />
                        ) : expenses.length === 0 ? (
                            <EmptyState 
                                icon={<Receipt size={48} />}
                                title="Belum ada tagihan"
                                description="Ayo mulai patungan dengan mencatat pengeluaran pertama!"
                                action={<Button onClick={() => navigate(`/groups/${groupId}/expenses/create`)}>Catat Tagihan</Button>}
                            />
                        ) : (
                            <div className="flex flex-col gap-4">
                                {expenses.map((expense, index) => {
                                    const isLastElement = expenses.length === index + 1;
                                    const currentDateHeader = formatDateHeader(expense.expenseDate);
                                    const prevExpense = index > 0 ? expenses[index - 1] : null;
                                    const showHeader = !prevExpense || formatDateHeader(prevExpense.expenseDate) !== currentDateHeader;
                                    
                                    return (
                                        <React.Fragment key={expense.id}>
                                            {showHeader && (
                                                <div className="self-center bg-primary text-white px-4 py-1 rounded-full text-[0.85rem] font-bold mt-4 shadow-sm">
                                                    {currentDateHeader}
                                                </div>
                                            )}
                                            <div ref={isLastElement ? lastElementRef : null}>
                                                <ExpenseCard 
                                                    id={expense.id}
                                                    description={expense.description}
                                                    totalAmount={String(expense.totalAmount)}
                                                    expenseDate={expense.expenseDate}
                                                    paidByUserName={expense.paidByUser?.name || 'Seseorang'}
                                                    paidByUserId={expense.paidBy}
                                                    currentUserId={currentUserId}
                                                    myShare={expense.shares.find(s => s.userId === currentUserId)}
                                                />
                                            </div>
                                        </React.Fragment>
                                    )
                                })}
                                {isFetchingNextPage && <SkeletonList count={1} />}
                                {!hasNextPage && expenses.length > 0 && <p className="text-center text-text-muted">Tamat. Tidak ada histori lagi.</p>}
                            </div>
                        )}
                    </main>
                </div> {/* END KIRI */}

                {/* --- 3. PANEL STATS (Kanan) --- */}
                <div className="flex flex-col gap-6 lg:sticky lg:top-8">
                    {/* --- TOMBOL CATAT TAGIHAN BARU --- */}
                    {expenses.length > 0 && (
                        <Button 
                            onClick={() => navigate(`/groups/${groupId}/expenses/create`)}
                            className="w-full text-[1.05rem] p-4 flex justify-center items-center gap-2 shadow-md mb-6"
                        >
                            <Plus size={20} /> Catat Tagihan Baru
                        </Button>
                    )}

                    {/* --- BANNER RINGKASAN UTANG --- */}
                    {!isBalanceLoading && balanceData && (
                        <div 
                            onClick={() => setIsBalanceModalOpen(true)}
                            className="flex flex-col gap-4 bg-surface p-6 rounded-xl border border-primary shadow-md cursor-pointer relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg mb-6"
                        >
                            <div className="absolute left-0 right-0 top-0 h-1.5 bg-primary"></div>
                            
                            <div className="mt-2">
                                <p className="m-0 text-[0.9rem] text-text-muted">Piutang (Orang utang ke kamu)</p>
                                <h3 className="m-0 text-primary">Rp {Number(balanceData.totalOwedToMe).toLocaleString('id-ID')}</h3>
                            </div>
                            <div>
                                <p className="m-0 text-[0.9rem] text-text-muted">Utangmu (Kamu utang ke orang)</p>
                                <h3 className="m-0 text-error">Rp {Number(balanceData.totalIOwe).toLocaleString('id-ID')}</h3>
                            </div>
                            <div className="self-start bg-surface-muted px-4 py-2 rounded-full text-[0.85rem] mt-2 flex items-center gap-1 hover:bg-border transition-colors">
                                Lihat Rincian <ArrowRight size={16} />
                            </div>
                        </div>
                    )}

                    {/* --- SARAN TRANSFER (PENYEDERHANAAN UTANG GRUP) --- */}
                    {groupId && <SettlementPlanCard groupId={groupId} currentUserId={currentUserId} />}
                </div> {/* END KANAN */}
            </div>

            {/* MODAL RINGKASAN MENGGUNAKAN GENERIC MODAL */}
            {balanceData && (
                <Modal 
                    isOpen={isBalanceModalOpen} 
                    onClose={() => setIsBalanceModalOpen(false)} 
                    title={selectedBalanceDetail ? `Rincian dengan ${selectedBalanceDetail.name}` : "Rincian Ringkasan Utang"}
                >
                    {selectedBalanceDetail ? (
                        <div>
                            <button 
                                onClick={() => setSelectedBalanceDetail(null)}
                                className="flex items-center gap-2 bg-transparent border-none text-primary cursor-pointer p-0 mb-6 text-[0.9rem] font-bold hover:text-primary-hover transition-colors"
                            >
                                <ArrowLeft size={16} /> Kembali
                            </button>
                            <h4 className={`m-0 mb-4 ${selectedBalanceDetail.isDebt ? 'text-error' : 'text-primary'}`}>
                                Total {selectedBalanceDetail.isDebt ? 'Utangmu' : 'Piutangmu'}: Rp {Number(selectedBalanceDetail.amount).toLocaleString('id-ID')}
                            </h4>
                            <div className="flex flex-col gap-3">
                                {selectedBalanceDetail.transactions.map(tx => (
                                    <div 
                                        key={tx.id} 
                                        onClick={() => {
                                            setIsBalanceModalOpen(false);
                                            navigate(`/expenses/${tx.id}`);
                                        }}
                                        className="flex justify-between items-center p-4 bg-surface-hover rounded-lg border border-border cursor-pointer hover:border-primary transition-colors"
                                    >
                                        <span className="font-bold text-text-main">{tx.description}</span>
                                        <span className={`font-bold ${tx.iOweThem ? 'text-error' : 'text-success-text'}`}>Rp {Number(tx.amount).toLocaleString('id-ID')}</span>
                                    </div>
                                ))}
                            </div>
                            {groupId && (
                                <SettleUpPanel
                                    groupId={groupId}
                                    counterpartyId={selectedBalanceDetail.userId}
                                    onSettled={() => setSelectedBalanceDetail(null)}
                                />
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="mb-8">
                                <h4 className="m-0 mb-4 text-error">Daftar Utangmu (Total: Rp {Number(balanceData.totalIOwe).toLocaleString('id-ID')})</h4>
                                {balanceData.iOwe.length === 0 ? (
                                    <p className="text-text-muted text-[0.9rem] flex items-center gap-2"><PartyPopper size={16} /> Kamu tidak punya utang ke siapapun!</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {balanceData.iOwe.map((item: any) => (
                                            <div 
                                                key={item.userId} 
                                                onClick={() => setSelectedBalanceDetail({ ...item, isDebt: true })}
                                                className="flex justify-between p-3 bg-surface-hover rounded-lg border border-border cursor-pointer hover:border-error transition-colors"
                                            >
                                                <span className="font-bold text-text-main">Ke {item.name}</span>
                                                <span className="text-error font-bold">Rp {Number(item.amount).toLocaleString('id-ID')}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="m-0 mb-4 text-primary">Daftar Piutangmu (Total: Rp {Number(balanceData.totalOwedToMe).toLocaleString('id-ID')})</h4>
                                {balanceData.owedToMe.length === 0 ? (
                                    <p className="text-text-muted text-[0.9rem] flex items-center gap-2"><Wallet size={16} /> Belum ada yang utang ke kamu.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {balanceData.owedToMe.map((item: any) => (
                                            <div 
                                                key={item.userId} 
                                                onClick={() => setSelectedBalanceDetail({ ...item, isDebt: false })}
                                                className="flex justify-between p-3 bg-surface-hover rounded-lg border border-border cursor-pointer hover:border-primary transition-colors"
                                            >
                                                <span className="font-bold text-text-main">Dari {item.name}</span>
                                                <span className="text-success-text font-bold">Rp {Number(item.amount).toLocaleString('id-ID')}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </Modal>
            )}

            {/* BOTTOM SHEET FILTER BIARKAN (KARENA SHEET BERBEDA DENGAN MODAL) */}
            {(isFilterSheetOpen || isClosingSheet) && (
                <div 
                    className={`fixed inset-0 bg-black/50 z-[999] flex flex-col justify-end transition-opacity duration-300 ${isClosingSheet ? 'opacity-0' : 'opacity-100'}`}
                    onClick={closeFilterSheet}
                >
                    <div 
                        className={`bg-surface p-8 rounded-t-[24px] pb-12 ${isClosingSheet ? 'animate-[slideDown_0.3s_ease-out_forwards]' : 'animate-[slideUp_0.3s_ease-out_forwards]'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1.5 bg-border rounded-full mx-auto mb-6"></div>
                        
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="m-0 text-xl font-bold">Filter Tagihan</h3>
                            <button onClick={closeFilterSheet} className="bg-transparent border-none text-2xl cursor-pointer text-text-muted hover:text-text-main transition-colors">&times;</button>
                        </div>

                        <div className="mb-6">
                            <label className="block mb-2 font-bold">Rentang Waktu</label>
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="date" 
                                    className="flex-1 p-2 border-[1.5px] border-border rounded-lg text-base bg-surface-hover text-text-main transition-all duration-200 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15" 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                <span className="text-text-muted">-</span>
                                <input 
                                    type="date" 
                                    className="flex-1 p-2 border-[1.5px] border-border rounded-lg text-base bg-surface-hover text-text-main transition-all duration-200 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="mb-8">
                            <label className="block mb-2 font-bold">Status Kamu</label>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-surface-hover rounded-lg transition-colors">
                                    <input type="radio" name="filterStatus" value="all" checked={filterType === 'all'} onChange={(e) => setFilterType(e.target.value)} className="w-4 h-4" />
                                    <span>Tampilkan Semua</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-surface-hover rounded-lg transition-colors">
                                    <input type="radio" name="filterStatus" value="involved" checked={filterType === 'involved'} onChange={(e) => setFilterType(e.target.value)} className="w-4 h-4" />
                                    <span>Ada Namaku (Terlibat)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-surface-hover rounded-lg transition-colors">
                                    <input type="radio" name="filterStatus" value="unpaid" checked={filterType === 'unpaid'} onChange={(e) => setFilterType(e.target.value)} className="w-4 h-4" />
                                    <span className="text-error font-bold">Belum Lunas</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-surface-hover rounded-lg transition-colors">
                                    <input type="radio" name="filterStatus" value="payer" checked={filterType === 'payer'} onChange={(e) => setFilterType(e.target.value)} className="w-4 h-4" />
                                    <span className="text-primary font-bold">Aku yang Nalangin</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button 
                                variant="outline" 
                                className="flex-1 py-3 text-lg"
                                onClick={() => {
                                    setSearchKeyword(''); setStartDate(''); setEndDate(''); setFilterType('all');
                                }}
                            >
                                Reset
                            </Button>
                            <Button className="flex-[2] py-3 text-lg" onClick={applyFilters}>
                                Terapkan Filter
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

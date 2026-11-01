import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { AlertTriangle, Scale, Trash2, ChevronDown, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { SkeletonForm } from '../components/ui/Skeleton';
import { getErrorMessage } from '../utils/errorHandler';
import type { ExpenseShare } from '../types';
import { useExpenses } from '../hooks/useExpenses';
import { getToken } from '../utils/token';

// Tipe data untuk daftar anggota yang bisa dipilih
interface Member {
    id: string;
    name: string;
}

// Helper Kalkulator Cepat
const evaluateMath = (expression: string | number): number | string => {
    if (typeof expression === 'number') return expression;
    try {
        const sanitized = expression.toString().replace(/[^0-9+\-*/().\s]/g, '');
        if (!sanitized) return '';
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${sanitized}`)();
        return isNaN(result) || !isFinite(result) ? '' : Math.round(result);
    } catch {
        return expression.toString();
    }
};

const sanitizeMathInput = (value: string) => {
    return value.replace(/[^0-9+\-*/().\s,]/g, '');
};

export const EditExpense = () => {
    const { id: expenseId } = useParams();
    const navigate = useNavigate();

    // Data dari backend
    const [isLocked, setIsLocked] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    // --- STATE FORM UTAMA ---
    const [description, setDescription] = useState('');
    const [totalAmount, setTotalAmount] = useState<number | string>('');
    const [expenseDate, setExpenseDate] = useState(() => {
        // Format YYYY-MM-DD untuk default awal
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000; // offset in milliseconds
        const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
        return localISOTime.split('T')[0]; 
    });
    const [isTimeSpecific, setIsTimeSpecific] = useState(false);

    // --- STATE UNTUK SPLIT BILL DINAMIS ---
    // Menyimpan baris pembagian tagihan: { userId, shareAmount }
    const [shares, setShares] = useState<{ userId: string, shareAmount: number | string }[]>([]);
    
    // State untuk daftar pilihan anggota grup (didapat dari Backend)
    const [members, setMembers] = useState<Member[]>([]);

    const [errorMsg, setErrorMsg] = useState('');

    // --- EFFECT ---
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const token = getToken();
                if (!token) throw new Error("Tidak ada token");
                
                // 1. Ambil data expense
                const expenseRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/expenses/${expenseId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const expenseData = await expenseRes.json();
                
                const currentUserId = token ? JSON.parse(atob(token.split('.')[1])).userId : '';
                if (expenseData.paidBy !== currentUserId) {
                    throw new Error("Akses ditolak. Kamu bukan penombok tagihan ini.");
                }

                const hasPaid = expenseData.shares.some((s: ExpenseShare) => s.isPaid && s.userId !== currentUserId);
                setIsLocked(hasPaid);
                setDescription(expenseData.description);
                setTotalAmount(expenseData.totalAmount);
                
                // Set tanggal & waktu
                const dateObj = new Date(expenseData.expenseDate);
                const isMidnightUTC = expenseData.expenseDate.endsWith("T00:00:00.000Z");
                
                if (isMidnightUTC) {
                    setIsTimeSpecific(false);
                    setExpenseDate(expenseData.expenseDate.split('T')[0]);
                } else {
                    setIsTimeSpecific(true);
                    const tzOffset = dateObj.getTimezoneOffset() * 60000;
                    const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
                    setExpenseDate(localISOTime);
                }

                setShares(expenseData.shares.map((s: ExpenseShare) => ({
                    userId: s.user?.id || s.userId, // jika API mereturn include user
                    shareAmount: s.shareAmount
                })));

                // 2. Ambil data member grup
                const membersRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/groups/${expenseData.groupId}/members`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const membersData = await membersRes.json();
                setMembers(membersData);
            } catch (err: unknown) {
                setErrorMsg(getErrorMessage(err));
            } finally {
                setIsFetching(false);
            }
        };

        fetchInitialData();
    }, [expenseId]);

    // --- HANDLER UNTUK SPLIT BILL ---

    // Hapus baris tertentu
    const handleRemoveShare = (index: number) => {
        const newShares = [...shares];
        newShares.splice(index, 1);
        setShares(newShares);
    };

    // Update nilai dari baris tertentu
    const handleShareChange = (index: number, field: 'userId' | 'shareAmount', value: string | number) => {
        const newShares = [...shares];
        newShares[index] = { ...newShares[index], [field]: value };
        setShares(newShares);
    };

    // Tombol pembantu: "Bagi Rata"
    const handleSplitEqually = () => {
        const evaluatedTotal = evaluateMath(totalAmount);
        if (!evaluatedTotal || typeof evaluatedTotal !== 'number' || shares.length === 0) return;
        
        setTotalAmount(evaluatedTotal); // Sync UI ke hasil hitung

        // Membulatkan ke bawah untuk nilai dasar, sisa (termasuk desimal) diberikan ke orang pertama
        const equalAmount = Math.floor(evaluatedTotal / shares.length);
        const remainder = evaluatedTotal - (equalAmount * shares.length);

        const newShares = shares.map((share, index) => ({ 
            ...share, 
            shareAmount: index === 0 ? equalAmount + remainder : equalAmount 
        }));
        setShares(newShares);
    };

    const { useEditExpense } = useExpenses();
    const editExpenseMutation = useEditExpense(expenseId, '', {
        onSuccess: () => {
            toast.success("Berhasil memperbarui tagihan!");
            navigate(`/expenses/${expenseId}`, { replace: true });
        },
        onError: (err: any) => {
            setErrorMsg(err.response?.data?.message || err.message || 'Gagal memperbarui tagihan');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        try {
            // Validasi Frontend Dasar
            const finalTotal = evaluateMath(totalAmount);
            if (!description || !finalTotal || typeof finalTotal !== 'number') {
                throw new Error("Deskripsi dan Total Nominal harus diisi dengan angka valid!");
            }
            if (shares.length === 0) {
                throw new Error("Pilih setidaknya satu anggota untuk ditagih.");
            }

            // Pastikan tidak ada data kosong di dalam shares
            const formattedShares = shares.map(s => {
                const finalShare = evaluateMath(s.shareAmount);
                if (!s.userId || !finalShare || typeof finalShare !== 'number') throw new Error("Ada baris anggota atau nominal yang kosong/tidak valid!");
                return { userId: s.userId, shareAmount: finalShare };
            });

            let finalExpenseDate = new Date(expenseDate);
            if (!isTimeSpecific) {
                finalExpenseDate = new Date(`${expenseDate}T00:00:00.000Z`);
            }

            const payload = {
                description,
                totalAmount: finalTotal,
                expenseDate: finalExpenseDate.toISOString(),
                shares: formattedShares
            };
            
            editExpenseMutation.mutate(payload);

        } catch (err: unknown) {
            setErrorMsg(getErrorMessage(err));
        }
    };

    // Removed early return

    return (
        <div className="dashboard-container pt-8 max-w-[1200px] mx-auto px-6 pb-12">
            <PageHeader title="Edit Tagihan" />

            <main className="dashboard-main mt-8">
                <div className="bg-surface p-8 rounded-xl shadow-sm">
                    {isLocked && (
                        <div className="p-4 bg-sky-100 text-sky-700 rounded-lg mb-6 font-bold flex items-center gap-2">
                            <Lock size={20} /> Karena sudah ada anggota yang membayar lunas, kamu hanya bisa mengubah Judul dan Tanggal. Kolom nominal telah dikunci.
                        </div>
                    )}
                    {errorMsg && (
                        <div className="p-4 bg-error-bg text-error rounded-lg mb-6 flex items-center gap-2">
                            <AlertTriangle size={20} /> {errorMsg}
                        </div>
                    )}

                    <form className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:items-stretch" onSubmit={handleSubmit}>
                        {isFetching ? (
                            <div className="p-8">
                                <SkeletonForm />
                            </div>
                        ) : (
                            <>
                                {/* 1. SPLIT BILL (KIRI) */}
                        <div className="relative">
                            <div className="lg:absolute lg:inset-0 flex flex-col">
                                <div className="flex justify-between items-center mb-4 shrink-0">
                                    <h3 className="m-0">Siapa saja yang berutang padamu?</h3>
                                    {!isLocked && (
                                        <Button type="button" variant="outline" onClick={handleSplitEqually} className="text-[0.85rem] px-4 py-2 flex gap-2 items-center">
                                            <Scale size={16} /> Bagi Rata
                                        </Button>
                                    )}
                                </div>

                                {/* Daftar Dinamis */}
                                <div className="flex flex-col gap-4 mb-4 flex-[0_1_auto] min-h-0 overflow-y-auto pr-2">
                                    {shares.map((share, index) => (
                                        <div key={index} className="p-5 bg-surface-hover rounded-xl border border-border flex flex-col gap-4">
                                        
                                        {/* Baris Atas: Nama dan Tombol Hapus */}
                                        <div className="flex gap-4 items-center">
                                            {/* Dropdown Anggota (Disabled/Read-only untuk yang sudah dipilih) */}
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <div className="p-2 bg-surface-muted rounded-lg border border-border text-text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                                                    {members.find(m => m.id === share.userId)?.name || 'Anggota'}
                                                </div>
                                            </div>

                                            {/* Tombol Hapus Baris */}
                                            {!isLocked && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveShare(index)}
                                                    className="bg-error text-white border-none rounded-full w-7 h-7 flex items-center justify-center text-[0.8rem] cursor-pointer shadow-sm shrink-0"
                                                    title="Hapus baris ini"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Baris Bawah: Input Nominal */}
                                        <div className="flex flex-col">
                                            <div className="flex items-center relative">
                                                <span className="absolute left-4 text-text-muted font-bold">Rp</span>
                                                <input 
                                                    type="text" 
                                                    className={`p-3 border-[1.5px] border-border rounded-lg text-base bg-surface-hover text-text-main transition-all duration-200 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 pl-12 w-full font-bold ${isLocked ? 'bg-surface-muted text-text-muted' : ''}`}

                                                    placeholder="0"
                                                    value={share.shareAmount}
                                                    disabled={isLocked}
                                                    onChange={e => handleShareChange(index, 'shareAmount', sanitizeMathInput(e.target.value))}
                                                    onBlur={() => handleShareChange(index, 'shareAmount', evaluateMath(share.shareAmount))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleShareChange(index, 'shareAmount', evaluateMath(share.shareAmount));
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Dropdown Langsung Tambah Anggota */}
                            {!isLocked && members.filter(m => !shares.some(s => s.userId === m.id)).length > 0 && (
                                <div className="relative shrink-0">
                                    <select 
                                        value=""
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setShares([...shares, { userId: e.target.value, shareAmount: '' }]);
                                            }
                                        }}
                                        className="p-3 w-full border-2 border-dashed border-border rounded-lg text-base bg-transparent text-primary transition-all duration-200 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 cursor-pointer font-bold text-center appearance-none"
                                    >
                                        <option value="" disabled>+ Klik untuk Tambah Anggota yang Ditagih...</option>
                                        {members.filter(m => !shares.some(s => s.userId === m.id)).map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
                                        <ChevronDown size={20} />
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. KANAN: INFO & SUBMIT */}
                    <div className="lg:flex lg:flex-col lg:justify-between">
                        <div className="pb-6 border-b border-border">
                            <h3 className="mb-4">Informasi Tagihan</h3>
                            
                            <div className="flex flex-col mb-4">
                                <label className="text-sm font-medium text-text-main mb-2">Deskripsi / Judul</label>
                                <input 
                                    type="text" 
                                    className="p-3 border-[1.5px] border-border rounded-lg text-base bg-surface-hover text-text-main transition-all duration-200 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15" 
                                    placeholder="Bayar apa hari ini?"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col mb-4">
                                <label className="text-sm font-medium text-text-main mb-2">Total Nominal (Rp) - Cth: 50000+15000</label>
                                <input 
                                    type="text" 
                                    className={`p-3 border-[1.5px] border-border rounded-lg text-base bg-surface-hover text-text-main transition-all duration-200 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 ${isLocked ? 'bg-surface-muted text-text-muted' : ''}`}
                                    placeholder="0"
                                    value={totalAmount}
                                    disabled={isLocked}
                                    onChange={e => setTotalAmount(sanitizeMathInput(e.target.value))}
                                    onBlur={() => setTotalAmount(evaluateMath(totalAmount))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            setTotalAmount(evaluateMath(totalAmount));
                                        }
                                    }}
                                />
                            </div>
                            
                            <div className="flex flex-col mb-4">
                                <label className="text-sm font-medium text-text-main mb-2">Tanggal Transaksi</label>
                                <input 
                                    type={isTimeSpecific ? "datetime-local" : "date"} 
                                    className="p-3 border-[1.5px] border-border rounded-lg text-base bg-surface-hover text-text-main transition-all duration-200 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15" 
                                    value={expenseDate}
                                    onChange={e => setExpenseDate(e.target.value)}
                                />
                                <label className="text-[0.8rem] flex items-center gap-[0.4rem] cursor-pointer text-primary mt-2">
                                    <input 
                                        type="checkbox" 
                                        checked={isTimeSpecific}
                                        onChange={(e) => {
                                            setIsTimeSpecific(e.target.checked);
                                            const now = new Date();
                                            const tzOffset = now.getTimezoneOffset() * 60000;
                                            const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
                                            
                                            if (e.target.checked) {
                                                setExpenseDate(localISOTime);
                                            } else {
                                                setExpenseDate(localISOTime.split('T')[0]);
                                            }
                                        }}
                                    />
                                    Atur Jam Spesifik
                                </label>
                            </div>
                        </div>

                        <div className="mt-4 pt-6 border-t border-border flex flex-col gap-4">
                            <div className="flex justify-between text-[1.1rem]">
                                <span>Total Tagihan:</span>
                                <span className="font-bold">Rp {totalAmount || 0}</span>
                            </div>
                            <div className="flex justify-between text-[1.1rem]">
                                <span>Total Alokasi (Split):</span>
                                <span className={`font-bold ${shares.reduce((sum, s) => sum + Number(s.shareAmount || 0), 0) !== Number(totalAmount) ? 'text-error' : 'text-primary'}`}>
                                    Rp {shares.reduce((sum, s) => sum + Number(s.shareAmount || 0), 0)}
                                </span>
                            </div>

                            <Button type="submit" disabled={editExpenseMutation.isPending} className="mt-4 w-full">
                                {editExpenseMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan!'}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </form>
    </div>
</main>
    </div>
);
};

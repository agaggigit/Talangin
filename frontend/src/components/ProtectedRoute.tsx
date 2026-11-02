import { Navigate } from 'react-router-dom';
import { hasValidToken } from '../utils/token';

// Ini adalah komponen bungkus (Wrapper)
// Tugasnya mengecek apakah user punya token sebelum diizinkan melihat "children" (isi halamannya)
export const ProtectedRoute = ({ children }: { children: React.ReactNode}) => {
    // Token tidak ada / rusak / kedaluwarsa -> ke halaman login
    if (!hasValidToken()) {
        return <Navigate to='/login' replace/>
    }

    // Jika ada token, silakan lewat!
    return <>{children}</>
}

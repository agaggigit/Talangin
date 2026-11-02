export const getToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const setToken = (token: string, rememberMe: boolean = true) => {
    if (rememberMe) {
        localStorage.setItem('token', token);
    } else {
        sessionStorage.setItem('token', token);
    }
};

export const removeToken = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
};

/** Isi token (tanpa verifikasi tanda tangan; itu tugas backend). null kalau formatnya rusak. */
const decodeToken = (token: string): { userId?: string; exp?: number } | null => {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
};

/**
 * Token ada, formatnya benar, dan belum kedaluwarsa.
 * Token yang tidak valid langsung dihapus supaya user diarahkan ke login.
 */
export const hasValidToken = (): boolean => {
    const token = getToken();
    if (!token) return false;

    const payload = decodeToken(token);
    const expired = payload?.exp !== undefined && payload.exp * 1000 <= Date.now();
    if (!payload?.userId || expired) {
        removeToken();
        return false;
    }
    return true;
};

import axios from 'axios';
import { getToken, removeToken } from '../utils/token';

// Buat instance axios dengan base URL dari environment variable
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor untuk MENAMBAHKAN token ke setiap request yang keluar
api.interceptors.request.use(
  (config) => {
    // Ambil token dari storage
    const token = getToken();
    
    // Jika token ada, selipkan ke header Authorization
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    // Tangani error saat request gagal dikonfigurasi
    return Promise.reject(error);
  }
);

// Interceptor RESPONSE: kalau backend bilang token tidak berlaku (401),
// hapus token dan arahkan ke login. Endpoint /auth/* dikecualikan
// (401 di sana artinya email/password salah, bukan sesi habis).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      removeToken();
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

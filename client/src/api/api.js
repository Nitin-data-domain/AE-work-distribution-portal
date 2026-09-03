import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  // If envUrl is missing, relative, or points to a preview/airoapp domain, force same-origin '/api' to bypass CORS entirely
  if (!envUrl || envUrl.startsWith('/') || envUrl.includes('airoapp.ai')) {
    return '/api';
  }
  return envUrl;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

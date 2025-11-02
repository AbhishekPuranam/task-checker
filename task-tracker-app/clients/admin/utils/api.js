import axios from 'axios';

// Configure API base URL
const getApiUrl = () => {
  // Use Traefik gateway /api path for all API requests
  // This works both in Docker and when accessing from browser
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api';
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: getApiUrl(),
  timeout: 10000,
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor - send token in Authorization header
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage (set by auth service after login)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle different types of errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } else if (error.response?.status === 429) {
      console.warn('Rate limit exceeded, will retry...');
    } else if (error.code === 'ERR_NETWORK') {
      console.warn('Network error, will retry...');
    }
    
    return Promise.reject(error);
  }
);

export default api;
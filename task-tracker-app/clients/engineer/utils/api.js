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
  timeout: 30000,
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor - cookies are sent automatically
api.interceptors.request.use(
  (config) => {
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
    if (error.response?.status === 401) {
      // Clear any stale auth data and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'http://localhost/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

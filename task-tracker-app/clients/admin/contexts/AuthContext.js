import React, { createContext, useContext, useReducer, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

const initialState = {
  user: null,
  token: typeof window !== 'undefined' ? typeof window !== 'undefined' && localStorage.getItem('token') : null,
  isLoading: true,
  isAuthenticated: false,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      if (typeof window !== 'undefined') {
        typeof window !== 'undefined' && localStorage.setItem('token', action.payload.token);
      }
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_FAIL':
    case 'REGISTER_FAIL':
    case 'LOGOUT':
      if (typeof window !== 'undefined') {
        typeof window !== 'undefined' && localStorage.removeItem('token');
      }
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'USER_LOADED':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'AUTH_ERROR':
      typeof window !== 'undefined' && localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Auth token is automatically handled by the api utility

  const loadUser = async () => {
    try {
      const response = await api.get('/auth/me');
      dispatch({ type: 'USER_LOADED', payload: response.data });
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR' });
    }
  };

  // Load user on app start - simplified to trust auth service
  useEffect(() => {
    const initAuth = async () => {
      console.log('=== ADMIN AUTH CONTEXT INIT ===');
      
      // Check if token is passed via URL hash (from auth service redirect)
      const hash = window.location.hash;
      if (hash && hash.includes('token=')) {
        const tokenMatch = hash.match(/token=([^&]+)/);
        const userMatch = hash.match(/user=([^&]+)/);
        
        if (tokenMatch) {
          const token = decodeURIComponent(tokenMatch[1]);
          console.log('📥 Token received via URL hash');
          typeof window !== 'undefined' && localStorage.setItem('token', token);
          
          // Get user from hash if available
          if (userMatch) {
            const userStr = decodeURIComponent(userMatch[1]);
            typeof window !== 'undefined' && localStorage.setItem('user', userStr);
            console.log('📥 User data received via URL hash');
            
            try {
              const user = JSON.parse(userStr);
              console.log('✅ User extracted from hash:', user);
              
              // Clear the hash from URL
              window.history.replaceState(null, '', window.location.pathname);
              
              // Set user as authenticated immediately
              dispatch({ type: 'USER_LOADED', payload: user });
              console.log('=== ADMIN AUTH CONTEXT INIT COMPLETE ===');
              return;
            } catch (error) {
              console.error('Error parsing user from hash:', error);
            }
          } else {
            // Try to decode JWT to get user info
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const user = {
                id: payload.userId,
                username: payload.username,
                role: payload.role
              };
              typeof window !== 'undefined' && localStorage.setItem('user', JSON.stringify(user));
              console.log('✅ User extracted from token:', user);
              
              // Clear the hash from URL
              window.history.replaceState(null, '', window.location.pathname);
              
              // Set user as authenticated immediately
              dispatch({ type: 'USER_LOADED', payload: user });
              console.log('=== ADMIN AUTH CONTEXT INIT COMPLETE ===');
              return;
            } catch (error) {
              console.error('Error decoding token:', error);
            }
          }
          
          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
      
      const token = typeof window !== 'undefined' && localStorage.getItem('token');
      const savedUser = typeof window !== 'undefined' && localStorage.getItem('user');
      
      console.log('Token:', token ? 'EXISTS' : 'MISSING');
      console.log('User:', savedUser);
      
      if (token && savedUser) {
        try {
          const user = JSON.parse(savedUser);
          console.log('✅ Loading user from localStorage:', user);
          // Trust localStorage and set user as authenticated immediately
          dispatch({ type: 'USER_LOADED', payload: user });
          
          // Verify token in background (don't block UI)
          api.get('/auth/me')
            .then((response) => {
              console.log('✅ Token verified successfully');
              // Update user data from backend in case it changed
              if (JSON.stringify(response.data) !== JSON.stringify(user)) {
                console.log('📝 Updating user data from backend');
                dispatch({ type: 'USER_LOADED', payload: response.data });
                localStorage.setItem('user', JSON.stringify(response.data));
              }
            })
            .catch((error) => {
              console.error('❌ Background token verification failed:', {
                status: error.response?.status,
                message: error.response?.data?.message || error.message
              });
              // Token invalid/expired - clear localStorage and logout
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              dispatch({ type: 'AUTH_ERROR' });
            });
        } catch (error) {
          console.error('Error parsing user:', error);
          dispatch({ type: 'AUTH_ERROR' });
        }
      } else {
        console.log('❌ No token/user, setting loading false');
        dispatch({ type: 'SET_LOADING', payload: false });
      }
      console.log('=== ADMIN AUTH CONTEXT INIT COMPLETE ===');
    };
    
    initAuth();
  }, []); // Remove state.token dependency to avoid loops

  const login = async (username, password) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.post('/auth/login', { username, password });
      dispatch({ type: 'LOGIN_SUCCESS', payload: response.data });
      return { success: true };
    } catch (error) {
      dispatch({ type: 'LOGIN_FAIL' });
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.post('/auth/register', userData);
      dispatch({ type: 'REGISTER_SUCCESS', payload: response.data });
      return { success: true };
    } catch (error) {
      dispatch({ type: 'REGISTER_FAIL' });
      return { 
        success: false, 
        message: error.response?.data?.message || 'Registration failed' 
      };
    }
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/auth/profile', profileData);
      dispatch({ type: 'USER_LOADED', payload: response.data });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Profile update failed' 
      };
    }
  };

  const changePassword = async (passwordData) => {
    try {
      await api.put('/auth/change-password', passwordData);
      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Password change failed' 
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
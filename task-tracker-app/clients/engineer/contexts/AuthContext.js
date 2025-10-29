import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadUser = async () => {
    try {
      // Check localStorage first
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        
        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser);
          
          // Verify token with backend
          try {
            const response = await api.get('/auth/me');
            setUser(response.data);
            setIsAuthenticated(true);
            // Update localStorage with fresh data
            localStorage.setItem('user', JSON.stringify(response.data));
            setIsLoading(false);
            return;
          } catch (verifyError) {
            console.error('Token verification failed:', verifyError.response?.status);
            // Token invalid - clear localStorage
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            setUser(null);
            setIsAuthenticated(false);
            setIsLoading(false);
            return;
          }
        }
      }

      // No localStorage data - try to fetch from API (shouldn't happen normally)
      const response = await api.get('/auth/me');
      setUser(response.data);
      setIsAuthenticated(true);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        logout,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

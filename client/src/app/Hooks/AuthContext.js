// Update your AuthContext.js
"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Function to get token from localStorage
  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  };

  // Function to set token
  const setToken = (token) => {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  };

  // Function to check authentication status
  const checkAuth = async () => {
    try {
      setLoading(true);
      
      const token = getToken();
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add Authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile`, {
        method: 'GET',
        headers,
        credentials: 'include' // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isAuthenticated && data.user) {
          setUser(data.user);
          setIsLoggedIn(true);
          console.log('User authenticated:', data.user);
        } else {
          setUser(null);
          setIsLoggedIn(false);
          setToken(null); // Clear invalid token
          console.log('User not authenticated');
        }
      } else {
        setUser(null);
        setIsLoggedIn(false);
        setToken(null); // Clear invalid token
        console.log('Authentication check failed:', response.status);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      setIsLoggedIn(false);
      setToken(null); // Clear token on error
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (email, password) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token); // Store token in localStorage
        setUser(data.user);
        setIsLoggedIn(true);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Always clear local state regardless of server response
      setUser(null);
      setIsLoggedIn(false);
      setToken(null);
      console.log('User logged out');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state on error
      setUser(null);
      setIsLoggedIn(false);
      setToken(null);
      return true;
    }
  };

  // Check authentication on mount and token changes
  useEffect(() => {
    checkAuth();
  }, []);

  // Listen for storage changes (token updates from other tabs)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value = {
    user,
    loading,
    isLoggedIn,
    login,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
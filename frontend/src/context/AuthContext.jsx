import React, { createContext, useState, useCallback } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children, user: initialUser }) => {
  const [user, setUser] = useState(initialUser);
  // Estado de carga agregado para sincronización de autenticación
  const [authLoading, setAuthLoading] = useState(true);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  const setLoading = useCallback((loading) => {
    setAuthLoading(loading);
  }, []);

  return (
    <AuthContext.Provider value={{ user, updateUser, authLoading, setLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

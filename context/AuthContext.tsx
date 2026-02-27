import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isVerified: boolean;
  setIsVerified: (value: boolean) => void;
  signOut: () => void; // Added this
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isVerified, setIsVerified] = useState(false);

  // Soft Logout: Locks the app without deleting the Supabase session
  const signOut = () => {
    setIsVerified(false);
  };

  return (
    <AuthContext.Provider value={{ isVerified, setIsVerified, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
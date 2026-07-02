import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function isLoggedIn() { return !!localStorage.getItem('hs_token'); }

export default function App() {
  const [auth, setAuth] = useState(isLoggedIn());

  useEffect(() => {
    const handler = () => setAuth(isLoggedIn());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <Routes>
      <Route path="/login" element={auth ? <Navigate to="/" /> : <Login onLogin={() => setAuth(true)} />} />
      <Route path="/*" element={auth ? <Dashboard onLogout={() => { localStorage.removeItem('hs_token'); setAuth(false); }} /> : <Navigate to="/login" />} />
    </Routes>
  );
}

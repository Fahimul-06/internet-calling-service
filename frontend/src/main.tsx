import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './pages/App';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import CallPage from './pages/CallPage';
import { getToken } from './lib/api';
import './styles/app.css';

function Protected({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to={getToken() ? '/dashboard' : '/login'} replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="dashboard" element={<Protected><DashboardPage /></Protected>} />
          <Route path="call/:roomId" element={<Protected><CallPage /></Protected>} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

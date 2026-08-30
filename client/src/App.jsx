import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import HODDashboard from './components/HODDashboard';
import FacultyDashboard from './components/FacultyDashboard';
import DeanDashboard from './components/DeanDashboard';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-page">
      <div className="spinner" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'HOD':      return <HODDashboard />;
    case 'Faculty':  return <FacultyDashboard />;
    case 'Dean':     return <DeanDashboard />;
    default:         return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          duration: 4000,
          style: { background:'#fff', color:'#1e293b', border:'1px solid #e2e8f0', borderRadius:'10px', fontSize:'14px', fontWeight:500, boxShadow:'0 8px 24px rgba(37,99,235,.12)' },
          success: { iconTheme: { primary:'#2563eb', secondary:'#fff' } },
          error:   { iconTheme: { primary:'#dc2626', secondary:'#fff' } },
        }} />
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout><DashboardRouter /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

import { useAuth } from '../context/AuthContext';
import { useNavigate, NavLink } from 'react-router-dom';
import { FiLogOut, FiUser } from 'react-icons/fi';
import { MdDashboard, MdAssignment, MdSchool } from 'react-icons/md';

const ROLE_MENUS = {
  Faculty: [
    { to: '/dashboard', label: 'My Tasks', icon: <MdAssignment /> },
  ],
  HOD: [
    { to: '/dashboard', label: 'HOD Dashboard',  icon: <MdDashboard /> },
  ],
  Dean: [
    { to: '/dashboard', label: 'Dean Dashboard', icon: <MdDashboard /> },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const collegeName = import.meta.env.VITE_COLLEGE_NAME || 'College Grievance Portal';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>{collegeName}</h2>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.75)', fontWeight: 600, display: 'block', marginTop: 4 }}>Staff Portal</span>
        </div>

        <nav className="sidebar-nav">
          {(ROLE_MENUS[user?.role] || []).map(item => (
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="u-name">{user?.name}</div>
            <span className="u-role">{user?.role}</span>
          </div>
          <button onClick={handleLogout} style={{ marginTop: 8 }}>
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <span className="topbar-title">
            {user?.role === 'Faculty' && 'Faculty Workspace'}
            {user?.role === 'HOD' && 'HOD Oversight & Reports'}
            {user?.role === 'Dean' && 'Dean Executive Control Panel'}
          </span>
          <div className="topbar-actions">
            <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>
              <FiUser style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {user?.name} ({user?.role})
            </span>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

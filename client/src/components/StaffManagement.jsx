import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { 
  FiX, FiPlus, FiCheckCircle, FiXCircle, FiEdit2, FiTrash2, 
  FiRefreshCw, FiShield, FiAlertTriangle, FiSearch, FiUserCheck, FiUsers 
} from 'react-icons/fi';

export default function StaffManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Create / Edit User Modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'Faculty',
    department: '',
    can_manage_staff: false,
  });

  // Simple Delete Confirmation Modal (pending_tasks_count === 0)
  const [userToDelete, setUserToDelete] = useState(null);

  // Reassign & Delete Modal (pending_tasks_count > 0)
  const [userToReassignDelete, setUserToReassignDelete] = useState(null);
  const [reassignToUserId, setReassignToUserId] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error(err.response?.data?.error || 'Failed to load staff accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Open Create Modal
  function handleOpenCreate() {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'Faculty',
      department: '',
      can_manage_staff: false,
    });
    setShowUserModal(true);
  }

  // Open Edit Modal
  function handleOpenEdit(u) {
    setEditingUser(u);
    setUserForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      password: '',
      role: u.role || 'Faculty',
      department: u.department || '',
      can_manage_staff: Boolean(u.can_manage_staff),
    });
    setShowUserModal(true);
  }

  // Save User (Create / Update)
  async function handleSaveUser(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.user_id}`, userForm);
        toast.success(`Staff account for ${editingUser.name} updated.`);
      } else {
        await api.post('/users', userForm);
        toast.success('New staff member added successfully.');
      }
      setShowUserModal(false);
      loadUsers();
    } catch (err) {
      console.error('Save user error:', err);
      toast.error(err.response?.data?.error || 'Failed to save staff account.');
    } finally {
      setSaving(false);
    }
  }

  // Toggle Active/Inactive
  async function handleToggleActive(u) {
    try {
      const res = await api.put(`/users/${u.user_id}/toggle`);
      toast.success(res.data.message);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update account status.');
    }
  }

  // Handle Delete Click
  function handleDeleteClick(u) {
    const pendingCount = Number(u.pending_tasks_count || 0);
    if (pendingCount > 0) {
      // Must reassign first!
      setUserToReassignDelete(u);
      setReassignToUserId('');
    } else {
      // Direct delete confirmation
      setUserToDelete(u);
    }
  }

  // Execute Direct Delete
  async function handleConfirmDelete() {
    if (!userToDelete) return;
    setSaving(true);
    try {
      const res = await api.delete(`/users/${userToDelete.user_id}`);
      toast.success(res.data.message || 'Staff account deleted.');
      setUserToDelete(null);
      loadUsers();
    } catch (err) {
      console.error('Delete error:', err);
      // If backend reports pending tasks, switch to reassign modal
      if (err.response?.data?.pendingCount > 0) {
        setUserToDelete(null);
        setUserToReassignDelete({ ...userToDelete, pending_tasks_count: err.response.data.pendingCount });
      } else {
        toast.error(err.response?.data?.error || 'Failed to delete account.');
      }
    } finally {
      setSaving(false);
    }
  }

  // Execute Reassign & Delete
  async function handleConfirmReassignAndDelete(e) {
    e.preventDefault();
    if (!userToReassignDelete) return;
    if (!reassignToUserId) {
      return toast.error('Please select an active staff member to transfer pending tasks to.');
    }
    setSaving(true);
    try {
      const res = await api.post(`/users/${userToReassignDelete.user_id}/reassign-and-delete`, {
        reassignToUserId: Number(reassignToUserId),
      });
      toast.success(res.data.message || 'Tasks reassigned and account deleted successfully.');
      setUserToReassignDelete(null);
      setReassignToUserId('');
      loadUsers();
    } catch (err) {
      console.error('Reassign & Delete error:', err);
      toast.error(err.response?.data?.error || 'Failed to reassign tasks and delete account.');
    } finally {
      setSaving(false);
    }
  }

  // Filtered staff members (excluding student accounts)
  const staffList = users.filter(u => u.role !== 'Student');
  const filteredStaff = staffList.filter(u => {
    const matchesSearch = 
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Candidate replacement staff list (active, not the one being deleted, not student)
  const candidateStaff = staffList.filter(
    u => Boolean(u.is_active) && u.user_id !== userToReassignDelete?.user_id
  );

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiUsers style={{ color: 'var(--blue-600)' }} /> Staff & Faculty Account Management
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--slate-500)' }}>
            Manage staff credentials, grant administrative delegation powers, reassign tasks, and control access.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadUsers} title="Refresh list">
            <FiRefreshCw /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
            <FiPlus /> Add Staff Member
          </button>
        </div>
      </div>

      <div className="card-body" style={{ padding: 0 }}>
        {/* Search & Filter Bar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--slate-200)', background: 'var(--slate-50)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 34, height: 38, fontSize: 13 }}
              placeholder="Search by name, email, or department..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', margin: 0 }}>Role:</label>
            <select
              className="form-control"
              style={{ width: 'auto', height: 38, fontSize: 13 }}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="Dean">Dean</option>
              <option value="HOD">HOD</option>
              <option value="Faculty">Faculty</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--slate-500)', fontWeight: 500 }}>
            Showing <strong>{filteredStaff.length}</strong> staff member{filteredStaff.length === 1 ? '' : 's'}
          </div>
        </div>

        {loading ? (
          <div className="spinner" style={{ margin: '40px auto' }} />
        ) : filteredStaff.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 20px' }}>
            <FiUsers className="empty-icon" />
            <p>No staff accounts found matching your search.</p>
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 850 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Staff Member</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Role</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Staff Privileges</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Email / Username</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Phone</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Department</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Workload</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(u => {
                  const isCurrent = Number(u.user_id) === Number(currentUser?.user_id);
                  const isDean = u.role === 'Dean';
                  const pendingCount = Number(u.pending_tasks_count || 0);
                  const canManage = Boolean(u.can_manage_staff) || isDean;

                  return (
                    <tr key={u.user_id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>
                          {u.name} {isCurrent && <span style={{ fontSize: 11, color: 'var(--blue-600)', fontWeight: 500 }}>(You)</span>}
                        </div>
                      </td>

                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className={`badge ${isDean ? 'badge-closed' : u.role === 'HOD' ? 'badge-internal' : 'badge-assigned'}`}>
                          {u.role}
                        </span>
                      </td>

                      <td style={{ whiteSpace: 'nowrap' }}>
                        {canManage ? (
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            padding: '3px 8px', 
                            borderRadius: '12px', 
                            fontSize: 11, 
                            fontWeight: 600,
                            background: '#eff6ff', 
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe'
                          }}>
                            <FiShield style={{ fontSize: 12 }} /> Staff Manager
                          </span>
                        ) : (
                          <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>Standard</span>
                        )}
                      </td>

                      <td style={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'nowrap' }}>{u.email}</td>
                      <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{u.phone || '—'}</td>
                      <td style={{ fontSize: 13 }}>{u.department || 'General'}</td>

                      <td style={{ whiteSpace: 'nowrap' }}>
                        {pendingCount > 0 ? (
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            padding: '3px 8px', 
                            borderRadius: '12px', 
                            fontSize: 11, 
                            fontWeight: 600,
                            background: '#fffbeb', 
                            color: '#b45309',
                            border: '1px solid #fde68a'
                          }}>
                            <FiAlertTriangle style={{ fontSize: 12 }} /> {pendingCount} Pending Task{pendingCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>0 Tasks</span>
                        )}
                      </td>

                      <td style={{ whiteSpace: 'nowrap' }}>
                        {u.is_active ? (
                          <span style={{ color: 'var(--green-700)', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <FiCheckCircle /> Active
                          </span>
                        ) : (
                          <span style={{ color: 'var(--red-600)', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <FiXCircle /> Inactive
                          </span>
                        )}
                      </td>

                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Edit Staff Credentials"
                            onClick={() => handleOpenEdit(u)}
                          >
                            <FiEdit2 /> Edit
                          </button>

                          {!isDean && !isCurrent && (
                            <button
                              className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                              title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                              onClick={() => handleToggleActive(u)}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}

                          {!isDean && !isCurrent && (
                            <button
                              className="btn btn-sm"
                              style={{ 
                                background: '#fef2f2', 
                                color: '#b91c1c', 
                                border: '1px solid #fecaca',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Delete Account"
                              onClick={() => handleDeleteClick(u)}
                            >
                              <FiTrash2 /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: CREATE / EDIT STAFF USER ──────────────────── */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? `Edit Account: ${editingUser.name}` : 'Add New Staff Member'}</h3>
              <button className="btn-icon" onClick={() => setShowUserModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    className="form-control"
                    required
                    placeholder="e.g. Dr. Rajesh Kumar"
                    value={userForm.name}
                    onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address / Username *</label>
                  <input
                    className="form-control"
                    type="email"
                    required
                    placeholder="staff@college.edu"
                    value={userForm.email}
                    onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      className="form-control"
                      placeholder="+91..."
                      value={userForm.phone}
                      onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Portal Role *</label>
                    <select
                      className="form-control"
                      value={userForm.role}
                      onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                    >
                      <option value="Faculty">Faculty</option>
                      <option value="HOD">HOD</option>
                      <option value="Dean">Dean</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Department / Program</label>
                  <input
                    className="form-control"
                    placeholder="e.g. Computer Science & Engineering"
                    value={userForm.department}
                    onChange={e => setUserForm(f => ({ ...f, department: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Password {editingUser ? '(leave blank to keep current password)' : '*'}
                  </label>
                  <input
                    className="form-control"
                    type="password"
                    required={!editingUser}
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={userForm.password}
                    onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>

                {/* Staff Management Privilege Checkbox */}
                <div style={{
                  marginTop: 18,
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={userForm.role === 'Dean' ? true : userForm.can_manage_staff}
                      disabled={userForm.role === 'Dean'}
                      onChange={e => setUserForm(f => ({ ...f, can_manage_staff: e.target.checked }))}
                      style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--blue-600)', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiShield style={{ color: 'var(--blue-600)' }} /> Grant Staff Management Privileges
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2, lineHeight: 1.4 }}>
                        Allows this staff member to create new staff accounts, edit login credentials, deactivate accounts, and reassign tasks. {userForm.role === 'Dean' ? '(Dean has this power by default)' : ''}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingUser ? 'Update Account' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM DIRECT DELETE ────────────────────── */}
      {userToDelete && (
        <div className="modal-overlay" onClick={() => setUserToDelete(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
                <FiTrash2 /> Delete Staff Account
              </h3>
              <button className="btn-icon" onClick={() => setUserToDelete(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--slate-700)', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete the account for <strong>{userToDelete.name}</strong> ({userToDelete.role})?
              </p>
              <div style={{ 
                background: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: 8, 
                padding: '12px 14px', 
                fontSize: 12, 
                color: '#991b1b',
                marginTop: 12
              }}>
                This account has no active tasks. Once deleted, this staff member will no longer be able to log in to the portal. This action cannot be reversed.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setUserToDelete(null)}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleConfirmDelete} 
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REASSIGN TASKS & DELETE ─────────────────────── */}
      {userToReassignDelete && (
        <div className="modal-overlay" onClick={() => setUserToReassignDelete(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309' }}>
                <FiAlertTriangle /> Reassign Tasks Before Deletion
              </h3>
              <button className="btn-icon" onClick={() => setUserToReassignDelete(null)}><FiX /></button>
            </div>
            <form onSubmit={handleConfirmReassignAndDelete}>
              <div className="modal-body">
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  padding: '14px 16px',
                  marginBottom: 16
                }}>
                  <div style={{ fontWeight: 700, color: '#92400e', fontSize: 14, marginBottom: 4 }}>
                    Active Workload Detected
                  </div>
                  <p style={{ fontSize: 13, color: '#78350f', margin: 0, lineHeight: 1.5 }}>
                    <strong>{userToReassignDelete.name}</strong> currently has{' '}
                    <strong>{userToReassignDelete.pending_tasks_count} active/pending grievance(s)</strong> assigned to them.
                  </p>
                  <p style={{ fontSize: 12, color: '#92400e', margin: '8px 0 0 0', lineHeight: 1.4 }}>
                    To ensure student grievances are not abandoned, you must reassign all pending tasks to another active faculty or HOD member before deleting this account.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Transfer All Pending Tasks To: *
                  </label>
                  <select
                    className="form-control"
                    required
                    value={reassignToUserId}
                    onChange={e => setReassignToUserId(e.target.value)}
                  >
                    <option value="">Select active staff member...</option>
                    {candidateStaff.map(c => (
                      <option key={c.user_id} value={c.user_id}>
                        {c.role === 'HOD' ? 'HOD' : 'Prof.'} {c.name} — {c.department || 'General'} ({c.role})
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--slate-500)', marginTop: 4, display: 'block' }}>
                    All {userToReassignDelete.pending_tasks_count} grievance(s) will be automatically transferred, audit history will be updated, and then the account will be safely deleted.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setUserToReassignDelete(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={saving || !reassignToUserId}
                >
                  {saving ? 'Transferring & Deleting...' : 'Transfer Tasks & Delete Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

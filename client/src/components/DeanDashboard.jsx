import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/api';
import StatusBadge from './StatusBadge';
import { formatFileUrl } from '../utils/fileUrl';
import { FiX, FiPlus, FiClock, FiUser, FiCheckCircle, FiXCircle, FiPaperclip, FiRefreshCw, FiEdit2, FiFileText, FiInbox } from 'react-icons/fi';

export default function DeanDashboard() {
  const [tab, setTab] = useState('grievances'); // grievances | faculty
  const [grievances, setGrievances] = useState([]);
  const [faculty, setFaculty]       = useState([]);
  const [hods, setHods]             = useState([]);
  const [allUsers, setAllUsers]     = useState([]);
  const [loading, setLoading]       = useState(true);

  // Selected Grievance Modal
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [history, setHistory]                     = useState([]);
  const [assignHodId, setAssignHodId]             = useState('');
  const [assignFacultyId, setAssignFacultyId]     = useState('');
  const [reassignFacultyId, setReassignFacultyId] = useState('');
  const [reassignReason, setReassignReason]       = useState('');
  const [remarkStudent, setRemarkStudent]         = useState('');
  const [remarkInternal, setRemarkInternal]       = useState('');
  const [statusUpdate, setStatusUpdate]           = useState('');
  const [studentFile, setStudentFile]             = useState(null);
  const [internalFile, setInternalFile]           = useState(null);
  const [saving, setSaving]                       = useState(false);

  // Internal Task Modal
  const [showInternalModal, setShowInternalModal] = useState(false);
  const [intForm, setIntForm] = useState({ title: '', description: '', faculty_id: '', hod_id: '' });

  // Faculty Management Modal (Create / Edit)
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser]   = useState(null);
  const [userForm, setUserForm]         = useState({ name: '', email: '', phone: '', password: '', role: 'Faculty', department: '' });

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [gRes, fRes, hRes, uRes] = await Promise.all([
        api.get('/grievances'),
        api.get('/users/faculty'),
        api.get('/users/hods'),
        api.get('/users'),
      ]);
      setGrievances(gRes.data.grievances);
      setFaculty(fRes.data.faculty);
      setHods(hRes.data.hods);
      setAllUsers(uRes.data.users);
    } catch {
      toast.error('Failed to load portal data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function openGrievance(g) {
    setSelectedGrievance(g);
    setStudentFile(null);
    setInternalFile(null);
    setAssignHodId(''); setAssignFacultyId(''); setReassignFacultyId(''); setReassignReason('');
    setRemarkStudent(g.remark_student || ''); setRemarkInternal(g.remark_internal || '');
    setStatusUpdate('');
    try {
      const res = await api.get(`/grievances/${g.grievance_id}/history`);
      setHistory(res.data.history);
    } catch { setHistory([]); }
  }

  async function handleAssignHOD() {
    if (!assignHodId) return toast.error('Select an HOD.');
    setSaving(true);
    try {
      await api.put(`/grievances/${selectedGrievance.grievance_id}/assign-hod`, { hod_id: assignHodId });
      toast.success('Assigned to HOD successfully.');
      setSelectedGrievance(null); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Assignment failed.'); }
    finally { setSaving(false); }
  }

  async function handleAssignFaculty() {
    if (!assignFacultyId) return toast.error('Select a faculty member.');
    setSaving(true);
    try {
      await api.put(`/grievances/${selectedGrievance.grievance_id}/assign-faculty`, { faculty_id: assignFacultyId });
      toast.success('Assigned directly to Faculty. Student & Faculty notified.');
      setSelectedGrievance(null); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Assignment failed.'); }
    finally { setSaving(false); }
  }

  async function handleReassignFaculty() {
    if (!reassignFacultyId) return toast.error('Select new faculty member.');
    setSaving(true);
    try {
      await api.put(`/grievances/${selectedGrievance.grievance_id}/reassign`, { faculty_id: reassignFacultyId, reason: reassignReason });
      toast.success('Reassigned successfully.');
      setSelectedGrievance(null); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Reassignment failed.'); }
    finally { setSaving(false); }
  }

  async function handleUpdateRemarks(e) {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      if (statusUpdate)   fd.append('status', statusUpdate);
      if (remarkStudent)  fd.append('remark_student', remarkStudent);
      if (remarkInternal) fd.append('remark_internal', remarkInternal);
      if (studentFile)    fd.append('faculty_file', studentFile);
      if (internalFile)   fd.append('internal_file', internalFile);
      await api.put(`/grievances/${selectedGrievance.grievance_id}/update`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Grievance updated.');
      setSelectedGrievance(null); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed.'); }
    finally { setSaving(false); }
  }

  async function handleCreateInternalTask(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/grievances/internal', intForm);
      toast.success('Internal task created and assigned.');
      setShowInternalModal(false);
      setIntForm({ title: '', description: '', faculty_id: '', hod_id: '' });
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Creation failed.'); }
    finally { setSaving(false); }
  }

  function openCreateUserModal() {
    setEditingUser(null);
    setUserForm({ name: '', email: '', phone: '', password: '', role: 'Faculty', department: '' });
    setShowUserModal(true);
  }

  function openEditUserModal(u) {
    setEditingUser(u);
    setUserForm({ name: u.name, email: u.email, phone: u.phone || '', password: '', role: u.role, department: u.department || '' });
    setShowUserModal(true);
  }

  async function handleSaveUser(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.user_id}`, userForm);
        toast.success(`User ${editingUser.name} updated.`);
      } else {
        await api.post('/users', userForm);
        toast.success('New staff account created.');
      }
      setShowUserModal(false); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save account.'); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(u) {
    try {
      const res = await api.put(`/users/${u.user_id}/toggle`);
      toast.success(res.data.message); loadData();
    } catch { toast.error('Failed to update status.'); }
  }

  const filteredGrievances = grievances.filter(g =>
    (!filterStatus || g.status === filterStatus) &&
    (!filterSource || g.source === filterSource)
  );

  const stats = {
    total:      grievances.length,
    pending:    grievances.filter(g => g.status === 'Submitted').length,
    inProgress: grievances.filter(g => g.status === 'In Progress' || g.status === 'Assigned').length,
    resolved:   grievances.filter(g => g.status === 'Resolved').length,
    totalStaff: allUsers.filter(u => u.role !== 'Student').length,
  };

  return (
    <>
      {/* Top Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card blue">
          <div className="stat-label">Total Grievances</div>
          <div className="stat-value">{stats.total}</div>
          <FiFileText className="stat-icon" />
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Pending Action</div>
          <div className="stat-value">{stats.pending}</div>
          <FiClock className="stat-icon" />
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--blue-400)' }}>
          <div className="stat-label">Active / In Progress</div>
          <div className="stat-value" style={{ color: 'var(--blue-500)' }}>{stats.inProgress}</div>
          <FiRefreshCw className="stat-icon" />
        </div>
        <div className="stat-card green">
          <div className="stat-label">Resolved</div>
          <div className="stat-value">{stats.resolved}</div>
          <FiCheckCircle className="stat-icon" />
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'grievances' ? 'active' : ''}`} onClick={() => setTab('grievances')}>
          Grievances Overseer <span className="tab-badge">{grievances.length}</span>
        </button>
        <button className={`tab-btn ${tab === 'faculty' ? 'active' : ''}`} onClick={() => setTab('faculty')}>
          <FiUser style={{ verticalAlign: 'middle', marginRight: 4 }} /> Staff & Faculty Credentials <span className="tab-badge">{stats.totalStaff}</span>
        </button>
      </div>

      {/* ── TAB 1: GRIEVANCES OVERSEER ───────────────────────── */}
      {tab === 'grievances' && (
        <div className="card">
          <div className="card-header">
            <h3>System Grievances & Tasks</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={loadData}><FiRefreshCw /></button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowInternalModal(true)}>
                <FiPlus /> New Internal Task
              </button>
            </div>
          </div>

          <div className="filter-bar">
            <label>Status:</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Submitted">Submitted (Pending)</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>

            <label>Source:</label>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}>
              <option value="">All Sources</option>
              <option value="Google Form">Google Form</option>
              <option value="Portal">Portal</option>
              <option value="Internal">Internal</option>
            </select>
          </div>

          {loading ? <div className="spinner" /> : filteredGrievances.length === 0 ? (
            <div className="empty-state"><FiInbox className="empty-icon" /><p>No grievances found matching criteria.</p></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th><th>Title</th><th>Student / Creator</th><th>Source</th><th>Status</th><th>HOD / Faculty</th><th>Date</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrievances.map(g => (
                    <tr key={g.grievance_id}>
                      <td><strong>#{g.grievance_id}</strong></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{g.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>{g.description?.substring(0, 45)}...</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{g.student_name || g.creator_name || 'N/A'}</div>
                        <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>{g.program_name}</div>
                      </td>
                      <td><StatusBadge source={g.source} /></td>
                      <td><StatusBadge status={g.status} /></td>
                      <td style={{ fontSize: 13 }}>
                        {g.faculty_name ? (
                          <div><span style={{ color: 'var(--blue-700)', fontWeight: 600 }}>Prof. {g.faculty_name}</span></div>
                        ) : g.hod_name ? (
                          <div><span style={{ color: 'var(--purple-600)', fontWeight: 600 }}>HOD: {g.hod_name}</span></div>
                        ) : (
                          <span style={{ color: 'var(--amber-600)', fontWeight: 600 }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                        {new Date(g.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openGrievance(g)}>Manage</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: STAFF & FACULTY CREDENTIALS ───────────────── */}
      {tab === 'faculty' && (
        <div className="card">
          <div className="card-header">
            <h3>Faculty & HOD Account Management</h3>
            <button className="btn btn-primary btn-sm" onClick={openCreateUserModal}>
              <FiPlus /> Add Staff Member
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? <div className="spinner" /> : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Staff Name</th>
                      <th>Role</th>
                      <th>Email / Username</th>
                      <th>Phone</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.filter(u => u.role !== 'Student').map(u => (
                      <tr key={u.user_id}>
                        <td>
                          <strong style={{ color: 'var(--slate-800)' }}>{u.name}</strong>
                        </td>
                        <td>
                          <span className={`badge ${u.role === 'Dean' ? 'badge-closed' : u.role === 'HOD' ? 'badge-internal' : 'badge-assigned'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{u.email}</td>
                        <td style={{ fontSize: 13 }}>{u.phone || '—'}</td>
                        <td style={{ fontSize: 13 }}>{u.department || 'General'}</td>
                        <td>
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
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" title="Edit Credentials" onClick={() => openEditUserModal(u)}>
                              <FiEdit2 /> Edit
                            </button>
                            {u.role !== 'Dean' && (
                              <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => handleToggleActive(u)}>
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: MANAGE GRIEVANCE ───────────────────────────── */}
      {selectedGrievance && (
        <div className="modal-overlay" onClick={() => setSelectedGrievance(null)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Grievance #{selectedGrievance.grievance_id}</h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <StatusBadge status={selectedGrievance.status} />
                  <StatusBadge source={selectedGrievance.source} />
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelectedGrievance(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <h4 style={{ marginBottom: 6 }}>{selectedGrievance.title}</h4>
              <p style={{ fontSize: 14, color: 'var(--slate-600)', marginBottom: 14 }}>{selectedGrievance.description}</p>

              {selectedGrievance.source !== 'Internal' && (
                <div style={{ background: 'var(--blue-50)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                  <strong>Student Name:</strong> {selectedGrievance.student_name} · <strong>Email:</strong> {selectedGrievance.student_email}<br />
                  <strong>Program:</strong> {selectedGrievance.program_name} · <strong>Admission No:</strong> {selectedGrievance.admission_no}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {selectedGrievance.file_url && (
                  <a href={formatFileUrl(selectedGrievance.file_url)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                    <FiPaperclip /> Student Attachment
                  </a>
                )}
                {selectedGrievance.faculty_file_url && (
                  <a href={formatFileUrl(selectedGrievance.faculty_file_url)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--green-600)', color: 'var(--green-700)' }}>
                    <FiPaperclip /> Student Response Doc
                  </a>
                )}
                {selectedGrievance.internal_file_url && (
                  <a href={formatFileUrl(selectedGrievance.internal_file_url)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--purple-600)', color: 'var(--purple-700)' }}>
                    <FiPaperclip /> Internal Staff Doc (Private)
                  </a>
                )}
              </div>

              {/* Assignment Options */}
              <div style={{ background: 'var(--slate-50)', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, color: 'var(--slate-800)', marginBottom: 10 }}>Task Delegation (Dean Controls)</h4>

                <div className="form-row" style={{ marginBottom: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 12 }}>Assign to HOD</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select className="form-control" style={{ fontSize: 13 }} value={assignHodId} onChange={e => setAssignHodId(e.target.value)}>
                        <option value="">Select HOD...</option>
                        {hods.filter(h => h.is_active).map(h => (
                          <option key={h.user_id} value={h.user_id}>HOD {h.name} ({h.department})</option>
                        ))}
                      </select>
                      <button className="btn btn-secondary btn-sm" onClick={handleAssignHOD} disabled={saving || !assignHodId}>Assign</button>
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: 12 }}>OR Assign Direct to Faculty</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select className="form-control" style={{ fontSize: 13 }} value={assignFacultyId} onChange={e => setAssignFacultyId(e.target.value)}>
                        <option value="">Select Faculty...</option>
                        {faculty.filter(f => f.is_active).map(f => (
                          <option key={f.user_id} value={f.user_id}>Prof. {f.name} ({f.department})</option>
                        ))}
                      </select>
                      <button className="btn btn-primary btn-sm" onClick={handleAssignFaculty} disabled={saving || !assignFacultyId}>Assign</button>
                    </div>
                  </div>
                </div>

                {selectedGrievance.assigned_to && selectedGrievance.status !== 'Resolved' && (
                  <div style={{ borderTop: '1px dashed var(--slate-300)', paddingTop: 10, marginTop: 10 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Reassign Currently Assigned Faculty (Prof. {selectedGrievance.faculty_name})</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <select className="form-control" style={{ fontSize: 13, flex: 1 }} value={reassignFacultyId} onChange={e => setReassignFacultyId(e.target.value)}>
                        <option value="">Select new faculty...</option>
                        {faculty.filter(f => f.is_active && f.user_id !== selectedGrievance.assigned_to).map(f => (
                          <option key={f.user_id} value={f.user_id}>Prof. {f.name}</option>
                        ))}
                      </select>
                      <input className="form-control" style={{ fontSize: 13, flex: 1 }} placeholder="Reason for transfer" value={reassignReason} onChange={e => setReassignReason(e.target.value)} />
                      <button className="btn btn-secondary btn-sm" onClick={handleReassignFaculty} disabled={saving || !reassignFacultyId}>Reassign</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Remarks Form */}
              <form onSubmit={handleUpdateRemarks}>
                <h4 style={{ marginBottom: 10, fontSize: 14 }}>Remarks & Status Override</h4>
                <div className="form-group">
                  <label className="form-label">Set Status</label>
                  <select className="form-control" value={statusUpdate} onChange={e => setStatusUpdate(e.target.value)}>
                    <option value="">-- No Change --</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                {selectedGrievance.source !== 'Internal' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Remark for Student <span style={{ color: 'var(--amber-600)', fontSize: 11 }}>(Emailed to student)</span></label>
                      <textarea className="form-control" rows={2} placeholder="Dean's message to student..." value={remarkStudent} onChange={e => setRemarkStudent(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Attach Document for Student <span style={{ color: 'var(--amber-600)', fontSize: 11 }}>(Emailed & visible to student)</span></label>
                      <label className="file-upload-zone">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setStudentFile(e.target.files[0] || null)} />
                        <FiPaperclip style={{ color: 'var(--blue-500)', fontSize: 18 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate-700)' }}>
                          {studentFile ? studentFile.name : 'Click to attach file for student'}
                        </span>
                      </label>
                      {studentFile && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--blue-700)', background: 'var(--blue-50)', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}>
                          <span>Selected student file: <strong>{studentFile.name}</strong> ({(studentFile.size / 1024).toFixed(1)} KB)</span>
                          <button type="button" onClick={() => setStudentFile(null)} style={{ background: 'none', border: 'none', color: 'var(--red-600)', cursor: 'pointer', fontWeight: 'bold' }}>Remove</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label">Internal Executive Remark <span style={{ color: 'var(--slate-400)', fontSize: 11 }}>(Staff only - Private)</span></label>
                  <textarea className="form-control" rows={2} placeholder="Internal administrative notes..." value={remarkInternal} onChange={e => setRemarkInternal(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Attach Internal Document <span style={{ color: 'var(--slate-400)', fontSize: 11 }}>(Staff only - Private)</span></label>
                  <label className="file-upload-zone" style={{ background: 'var(--slate-100)', borderColor: 'var(--slate-300)' }}>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setInternalFile(e.target.files[0] || null)} />
                    <FiPaperclip style={{ color: 'var(--slate-600)', fontSize: 18 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate-700)' }}>
                      {internalFile ? internalFile.name : 'Click to attach internal document for staff'}
                    </span>
                  </label>
                  {internalFile && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--slate-700)', background: 'var(--slate-100)', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}>
                      <span>Selected internal file: <strong>{internalFile.name}</strong> ({(internalFile.size / 1024).toFixed(1)} KB)</span>
                      <button type="button" onClick={() => setInternalFile(null)} style={{ background: 'none', border: 'none', color: 'var(--red-600)', cursor: 'pointer', fontWeight: 'bold' }}>Remove</button>
                    </div>
                  )}
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving...' : 'Save Remarks & Status'}</button>
              </form>

              {/* Audit History */}
              {history.length > 0 && (
                <div style={{ marginTop: 20, borderTop: '1px solid var(--slate-200)', paddingTop: 14 }}>
                  <h4 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><FiClock /> Audit Trail</h4>
                  <div className="timeline">
                    {history.map(h => (
                      <div className="timeline-item" key={h.history_id}>
                        <div className="t-action">{h.action}</div>
                        <div className="t-meta">{h.actor_name} · {new Date(h.changed_at).toLocaleString('en-IN')}</div>
                        {h.remark && <div className="t-remark">{h.remark}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE INTERNAL TASK ───────────────────────── */}
      {showInternalModal && (
        <div className="modal-overlay" onClick={() => setShowInternalModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Administrative Task</h3>
              <button className="btn-icon" onClick={() => setShowInternalModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreateInternalTask}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Subject *</label>
                  <input className="form-control" required placeholder="e.g. Verify NAAC Accreditation Data" value={intForm.title} onChange={e => setIntForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Instructions & Details *</label>
                  <textarea className="form-control" required rows={4} placeholder="Full task instructions..." value={intForm.description} onChange={e => setIntForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign To Faculty</label>
                  <select className="form-control" value={intForm.faculty_id} onChange={e => setIntForm(f => ({ ...f, faculty_id: e.target.value }))}>
                    <option value="">Select Faculty...</option>
                    {faculty.filter(f => f.is_active).map(f => (
                      <option key={f.user_id} value={f.user_id}>Prof. {f.name} ({f.department})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInternalModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT STAFF USER ──────────────────── */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? `Edit Account: ${editingUser.name}` : 'Create New Staff Account'}</h3>
              <button className="btn-icon" onClick={() => setShowUserModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" required placeholder="e.g. Dr. Ramesh Kumar" value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input className="form-control" type="email" required placeholder="name@college.edu" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" placeholder="+91..." value={userForm.phone} onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select className="form-control" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="Faculty">Faculty</option>
                      <option value="HOD">HOD</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Department / Program</label>
                  <input className="form-control" placeholder="e.g. Computer Science & Eng." value={userForm.department} onChange={e => setUserForm(f => ({ ...f, department: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password {editingUser ? '(leave blank to keep unchanged)' : '*'}</label>
                  <input className="form-control" type="password" required={!editingUser} minLength={6} placeholder="Account password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

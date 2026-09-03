import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/api';
import StatusBadge from './StatusBadge';
import { formatFileUrl } from '../utils/fileUrl';
import { FiX, FiPaperclip, FiClock, FiRefreshCw, FiFileText, FiCheckCircle, FiInbox } from 'react-icons/fi';

export default function FacultyDashboard() {
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [faculty, setFaculty]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory]   = useState([]);
  const [updateForm, setUpdateForm] = useState({ status:'', remark_student:'', remark_internal:'' });
  const [reassignId, setReassignId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [studentFile, setStudentFile]   = useState(null);
  const [internalFile, setInternalFile] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [tab, setTab] = useState('active'); // active | resolved

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/grievances');
      setTasks(res.data.grievances || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      toast.error(err.response?.data?.error || 'Failed to load tasks.');
    }

    try {
      const fRes = await api.get('/users/faculty');
      setFaculty(fRes.data.faculty || []);
    } catch (err) {
      console.error('Failed to load faculty list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openTask(t) {
    setSelected(t);
    setStudentFile(null);
    setInternalFile(null);
    setUpdateForm({ status: t.status === 'Resolved' ? 'Resolved' : '', remark_student: t.remark_student || '', remark_internal: t.remark_internal || '' });
    setReassignId(''); setReassignReason('');
    try {
      const res = await api.get(`/grievances/${t.grievance_id}/history`);
      setHistory(res.data.history);
    } catch { setHistory([]); }
  }

  async function handleUpdate(e) {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      if (updateForm.status)          fd.append('status',          updateForm.status);
      if (updateForm.remark_student)  fd.append('remark_student',  updateForm.remark_student);
      if (updateForm.remark_internal) fd.append('remark_internal', updateForm.remark_internal);
      if (studentFile)                fd.append('faculty_file',   studentFile);
      if (internalFile)               fd.append('internal_file',  internalFile);
      await api.put(`/grievances/${selected.grievance_id}/update`, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      toast.success('Task updated! Notifications sent.');
      setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed.'); }
    finally { setSaving(false); }
  }

  async function handleReassign() {
    if (!reassignId) return toast.error('Select a faculty member.');
    setSaving(true);
    try {
      await api.put(`/grievances/${selected.grievance_id}/reassign`, { faculty_id: reassignId, reason: reassignReason });
      toast.success('Task reassigned.'); setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Reassign failed.'); }
    finally { setSaving(false); }
  }

  const activeTasks   = tasks.filter(t => !['Resolved','Closed'].includes(t.status));
  const resolvedTasks = tasks.filter(t =>  ['Resolved','Closed'].includes(t.status));
  const shown         = tab === 'active' ? activeTasks : resolvedTasks;

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card blue">
          <div className="stat-label">Total Assigned</div>
          <div className="stat-value">{tasks.length}</div>
          <FiFileText className="stat-icon" />
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Active Tasks</div>
          <div className="stat-value">{activeTasks.length}</div>
          <FiClock className="stat-icon" />
        </div>
        <div className="stat-card green">
          <div className="stat-label">Resolved</div>
          <div className="stat-value">{resolvedTasks.length}</div>
          <FiCheckCircle className="stat-icon" />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>My Tasks</h3>
          <button className="btn btn-secondary btn-sm" onClick={load}><FiRefreshCw /> Refresh</button>
        </div>

        <div style={{ padding:'0 24px' }}>
          <div className="tabs">
            <button className={`tab-btn ${tab==='active'?'active':''}`} onClick={() => setTab('active')}>
              Active <span className="tab-badge">{activeTasks.length}</span>
            </button>
            <button className={`tab-btn ${tab==='resolved'?'active':''}`} onClick={() => setTab('resolved')}>
              Resolved <span className="tab-badge">{resolvedTasks.length}</span>
            </button>
          </div>
        </div>

        {loading ? <div className="spinner" /> : shown.length === 0 ? (
          <div className="empty-state">
            <FiInbox className="empty-icon" />
            <p>No {tab} tasks.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Title</th><th>Student</th><th>Source</th><th>Status</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {shown.map(t => (
                  <tr key={t.grievance_id}>
                    <td><strong>#{t.grievance_id}</strong></td>
                    <td>
                      <div style={{ fontWeight:600 }}>{t.title}</div>
                      <div style={{ fontSize:12, color:'var(--slate-500)' }}>{t.description?.substring(0,50)}...</div>
                    </td>
                    <td>
                      <div style={{ fontWeight:500 }}>{t.student_name || 'N/A'}</div>
                      <div style={{ fontSize:12, color:'var(--slate-500)' }}>{t.program_name}</div>
                    </td>
                    <td><StatusBadge source={t.source} /></td>
                    <td><StatusBadge status={t.status} /></td>
                    <td style={{ fontSize:13, color:'var(--slate-500)' }}>
                      {new Date(t.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openTask(t)}>
                        {t.source==='Internal' ? 'Update' : 'Manage'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task Detail & Update Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth:680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Task #{selected.grievance_id}</h3>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <StatusBadge status={selected.status} />
                  <StatusBadge source={selected.source} />
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelected(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <h4 style={{ marginBottom:6 }}>{selected.title}</h4>
              <p style={{ fontSize:14, color:'var(--slate-600)', marginBottom:16 }}>{selected.description}</p>

              {selected.source !== 'Internal' && (
                <div style={{ background:'var(--blue-50)', borderRadius:'var(--radius-md)', padding:'10px 14px', marginBottom:16, fontSize:13 }}>
                  <strong>Student:</strong> {selected.student_name} · {selected.student_email}<br />
                  <strong>Program:</strong> {selected.program_name} · <strong>Adm. No:</strong> {selected.admission_no}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {selected.file_url && (
                  <a href={formatFileUrl(selected.file_url)}
                    target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                    <FiPaperclip /> Student Attachment
                  </a>
                )}
                {selected.faculty_file_url && (
                  <a href={formatFileUrl(selected.faculty_file_url)}
                    target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--green-600)', color: 'var(--green-700)' }}>
                    <FiPaperclip /> Student Response Doc
                  </a>
                )}
                {selected.internal_file_url && (
                  <a href={formatFileUrl(selected.internal_file_url)}
                    target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--purple-600)', color: 'var(--purple-700)' }}>
                    <FiPaperclip /> Internal Staff Doc (Private)
                  </a>
                )}
              </div>

              {/* Update Form */}
              <form onSubmit={handleUpdate}>
                <div className="form-group">
                  <label className="form-label">Update Status</label>
                  <select className="form-control" value={updateForm.status}
                    onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="">-- Keep current --</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                {selected.source !== 'Internal' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">
                        Message for Student <span style={{ color:'var(--amber-600)', fontSize:11 }}>(Will be emailed)</span>
                      </label>
                      <textarea className="form-control" rows={3}
                        placeholder="e.g. Your marksheet request is being processed. Please visit COE office with your fee receipt."
                        value={updateForm.remark_student}
                        onChange={e => setUpdateForm(f => ({ ...f, remark_student: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Attach Document for Student <span style={{ color:'var(--amber-600)', fontSize:11 }}>(Emailed & visible to student)</span></label>
                      <label className="file-upload-zone">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setStudentFile(e.target.files[0] || null)} />
                        <FiPaperclip style={{ color:'var(--blue-500)', fontSize:18 }} />
                        <span style={{ fontSize:13, fontWeight: 500, color:'var(--slate-700)' }}>
                          {studentFile ? studentFile.name : 'Click to attach file for student'}
                        </span>
                      </label>
                      {studentFile && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--blue-700)', background: 'var(--blue-50)', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}>
                          <span>Selected student file: <strong>{studentFile.name}</strong> ({(studentFile.size / 1024).toFixed(1)} KB)</span>
                          <button type="button" onClick={() => setStudentFile(null)} style={{ background: 'none', border: 'none', color: 'var(--red-600)', cursor: 'pointer', fontWeight: 700 }}>Remove</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label">
                    Internal Remark <span style={{ color:'var(--slate-400)', fontSize:11 }}>(Staff only - Private)</span>
                  </label>
                  <textarea className="form-control" rows={2}
                    placeholder="Internal notes for administration..."
                    value={updateForm.remark_internal}
                    onChange={e => setUpdateForm(f => ({ ...f, remark_internal: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Attach Internal Document <span style={{ color:'var(--slate-400)', fontSize:11 }}>(Staff only - Private)</span></label>
                  <label className="file-upload-zone" style={{ background: 'var(--slate-100)', borderColor: 'var(--slate-300)' }}>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setInternalFile(e.target.files[0] || null)} />
                    <FiPaperclip style={{ color:'var(--slate-600)', fontSize:18 }} />
                    <span style={{ fontSize:13, fontWeight: 500, color:'var(--slate-700)' }}>
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
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Update'}</button>
              </form>

              {/* Reassign Section */}
              {selected.status !== 'Resolved' && (
                <div style={{ marginTop:24, borderTop:'1px solid var(--slate-200)', paddingTop:16 }}>
                  <h4 style={{ marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                    <FiRefreshCw /> Reassign to Another Faculty
                  </h4>
                  <div className="form-row">
                    <div className="form-group">
                      <select className="form-control" value={reassignId} onChange={e => setReassignId(e.target.value)}>
                        <option value="">Select faculty...</option>
                        {faculty.filter(f => f.is_active && f.user_id !== selected.assigned_to).map(f => (
                          <option key={f.user_id} value={f.user_id}>Prof. {f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <input className="form-control" placeholder="Reason (optional)"
                        value={reassignReason} onChange={e => setReassignReason(e.target.value)} />
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handleReassign} disabled={saving || !reassignId}>
                    Reassign Task
                  </button>
                </div>
              )}

              {/* History */}
              {history.length > 0 && (
                <div style={{ marginTop:24, borderTop:'1px solid var(--slate-200)', paddingTop:16 }}>
                  <h4 style={{ marginBottom:12, display:'flex', alignItems:'center', gap:8 }}><FiClock /> History</h4>
                  <div className="timeline">
                    {history.map(h => (
                      <div className="timeline-item" key={h.history_id}>
                        <div className="t-action">{h.action}</div>
                        <div className="t-meta">by {h.actor_name} · {new Date(h.changed_at).toLocaleString('en-IN')}</div>
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
    </>
  );
}

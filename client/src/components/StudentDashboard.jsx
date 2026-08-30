import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import { formatFileUrl } from '../utils/fileUrl';
import { FiPlus, FiPaperclip, FiX, FiClock, FiUser } from 'react-icons/fi';
import { MdOutlineGrievance } from 'react-icons/md';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [selected, setSelected]     = useState(null);
  const [history, setHistory]       = useState([]);
  const [form, setForm]  = useState({ title:'', description:'', admission_no:'', program_name:'' });
  const [file, setFile]  = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/grievances');
      setGrievances(res.data.grievances);
    } catch { toast.error('Failed to load grievances.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openDetail(g) {
    setSelected(g);
    try {
      const res = await api.get(`/grievances/${g.grievance_id}/history`);
      setHistory(res.data.history);
    } catch { setHistory([]); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.description) return toast.error('Title and description are required.');
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append('file', file);
      await api.post('/grievances', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Grievance submitted! Check your email for confirmation.');
      setShowModal(false);
      setForm({ title:'', description:'', admission_no:'', program_name:'' });
      setFile(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Submission failed.'); }
    finally { setSubmitting(false); }
  }

  const stats = {
    total:    grievances.length,
    open:     grievances.filter(g => !['Resolved','Closed'].includes(g.status)).length,
    resolved: grievances.filter(g => g.status === 'Resolved').length,
  };

  return (
    <>
      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card blue">
          <div className="stat-label">Total Submitted</div>
          <div className="stat-value">{stats.total}</div>
          <span className="stat-icon">📋</span>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{stats.open}</div>
          <span className="stat-icon">⏳</span>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Resolved</div>
          <div className="stat-value">{stats.resolved}</div>
          <span className="stat-icon">✅</span>
        </div>
      </div>

      {/* Grievances List */}
      <div className="card">
        <div className="card-header">
          <h3>My Grievances</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <FiPlus /> New Grievance
          </button>
        </div>

        {loading ? <div className="spinner" /> : grievances.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📬</div>
            <p>No grievances submitted yet.<br />Click "New Grievance" to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Title</th><th>Status</th><th>Assigned To</th><th>Submitted</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {grievances.map(g => (
                  <tr key={g.grievance_id}>
                    <td><strong>#{g.grievance_id}</strong></td>
                    <td>
                      <div style={{ fontWeight:600, color:'var(--slate-800)' }}>{g.title}</div>
                      <div style={{ fontSize:12, color:'var(--slate-500)', marginTop:2 }}>{g.description?.substring(0,60)}...</div>
                    </td>
                    <td><StatusBadge status={g.status} /></td>
                    <td>
                      {g.faculty_name
                        ? <span style={{ color:'var(--blue-700)', fontWeight:600 }}><FiUser style={{ verticalAlign:'middle', marginRight:4 }}/>Prof. {g.faculty_name}</span>
                        : <span style={{ color:'var(--slate-400)' }}>Pending assignment</span>
                      }
                    </td>
                    <td style={{ fontSize:13, color:'var(--slate-500)' }}>
                      {new Date(g.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openDetail(g)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submit New Grievance</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Subject / Title *</label>
                  <input className="form-control" required placeholder="Brief summary of your issue"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Admission No.</label>
                    <input className="form-control" placeholder="Your admission number"
                      value={form.admission_no} onChange={e => setForm(f => ({ ...f, admission_no: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Program</label>
                    <input className="form-control" placeholder="e.g. BCA, MBA"
                      value={form.program_name} onChange={e => setForm(f => ({ ...f, program_name: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Describe Your Issue *</label>
                  <textarea className="form-control" required rows={5} placeholder="Provide full details..."
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Attachment (PDF / JPG / PNG, max 10MB)</label>
                  <label className="file-upload-zone">
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} />
                    <FiPaperclip style={{ fontSize:24, color:'var(--blue-400)', marginBottom:6 }} />
                    <div style={{ fontSize:13, color:'var(--slate-600)' }}>
                      {file ? file.name : 'Click or drag to attach a file'}
                    </div>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Grievance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth:640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Grievance #{selected.grievance_id}</h3>
              <button className="btn-icon" onClick={() => setSelected(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
                <StatusBadge status={selected.status} />
                <StatusBadge source={selected.source} />
              </div>
              <h4 style={{ marginBottom:8 }}>{selected.title}</h4>
              <p style={{ fontSize:14, color:'var(--slate-600)', marginBottom:16 }}>{selected.description}</p>

              {selected.faculty_name && (
                <div style={{ background:'var(--blue-50)', border:'1px solid var(--blue-200)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--blue-700)', marginBottom:4 }}>CURRENTLY HANDLED BY</div>
                  <div style={{ fontWeight:600, color:'var(--slate-800)' }}>Prof. {selected.faculty_name}</div>
                  {selected.faculty_email && <div style={{ fontSize:12, color:'var(--slate-500)' }}>{selected.faculty_email}</div>}
                </div>
              )}

              {selected.remark_student && (
                <div className="remark-box student">
                  <div className="remark-label">Message from Faculty</div>
                  <div style={{ fontSize:14 }}>{selected.remark_student}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {selected.file_url && (
                  <a href={formatFileUrl(selected.file_url)}
                    target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                    <FiPaperclip /> My Submission Attachment
                  </a>
                )}
                {selected.faculty_file_url && (
                  <a href={formatFileUrl(selected.faculty_file_url)}
                    target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--green-600)', color: 'var(--green-700)' }}>
                    <FiPaperclip /> Faculty Response Document
                  </a>
                )}
              </div>

              {history.length > 0 && (
                <>
                  <h4 style={{ margin:'24px 0 12px', display:'flex', alignItems:'center', gap:8 }}>
                    <FiClock /> Progress Timeline
                  </h4>
                  <div className="timeline">
                    {history.map(h => (
                      <div className="timeline-item" key={h.history_id}>
                        <div className="t-action">{h.action}</div>
                        <div className="t-meta">by {h.actor_name} · {new Date(h.changed_at).toLocaleString('en-IN')}</div>
                        {h.remark && <div className="t-remark">{h.remark}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

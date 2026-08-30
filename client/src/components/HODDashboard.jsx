import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import { formatFileUrl } from '../utils/fileUrl';
import { FiX, FiDownload, FiPlus, FiClock, FiRefreshCw, FiPaperclip, FiFileText, FiCheckCircle, FiInbox } from 'react-icons/fi';
import { MdBarChart } from 'react-icons/md';

export default function HODDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('grievances');
  const [grievances, setGrievances] = useState([]);
  const [faculty, setFaculty]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [history, setHistory]       = useState([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');

  // Assign/reassign
  const [assignFacultyId, setAssignFacultyId] = useState('');
  const [reassignFacultyId, setReassignFacultyId] = useState('');
  const [reassignReason, setReassignReason]   = useState('');

  // Remarks & File
  const [remarkStudent,  setRemarkStudent]  = useState('');
  const [remarkInternal, setRemarkInternal] = useState('');
  const [statusUpdate, setStatusUpdate]     = useState('');
  const [studentFile, setStudentFile]       = useState(null);
  const [internalFile, setInternalFile]     = useState(null);
  const [saving, setSaving]                 = useState(false);

  // Internal task
  const [showInternal, setShowInternal] = useState(false);
  const [intForm, setIntForm] = useState({ title:'', description:'', faculty_id:'' });

  // Reports
  const [reportYear, setReportYear]   = useState(new Date().getFullYear());
  const [summary, setSummary]         = useState(null);
  const [monthly, setMonthly]         = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [gRes, fRes] = await Promise.all([api.get('/grievances'), api.get('/users/faculty')]);
      setGrievances(gRes.data.grievances);
      setFaculty(fRes.data.faculty);
    } catch { toast.error('Failed to load data.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadReport() {
    setReportLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([
        api.get(`/reports/summary?year=${reportYear}`),
        api.get(`/reports/monthly?year=${reportYear}`),
      ]);
      setSummary(sRes.data.summary);
      setMonthly(mRes.data.report);
    } catch { toast.error('Failed to load report.'); }
    finally { setReportLoading(false); }
  }

  useEffect(() => { if (tab === 'reports') loadReport(); }, [tab, reportYear]);

  async function openGrievance(g) {
    setSelected(g);
    setStudentFile(null);
    setInternalFile(null);
    setAssignFacultyId(''); setReassignFacultyId(''); setReassignReason('');
    setRemarkStudent(g.remark_student || ''); setRemarkInternal(g.remark_internal || '');
    setStatusUpdate('');
    try { const r = await api.get(`/grievances/${g.grievance_id}/history`); setHistory(r.data.history); }
    catch { setHistory([]); }
  }

  async function handleAssignFaculty() {
    if (!assignFacultyId) return toast.error('Select a faculty member.');
    setSaving(true);
    try {
      await api.put(`/grievances/${selected.grievance_id}/assign-faculty`, { faculty_id: assignFacultyId });
      toast.success('Assigned to faculty. Notifications sent.'); setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
    finally { setSaving(false); }
  }

  async function handleReassign() {
    if (!reassignFacultyId) return toast.error('Select new faculty.');
    setSaving(true);
    try {
      await api.put(`/grievances/${selected.grievance_id}/reassign`, { faculty_id: reassignFacultyId, reason: reassignReason });
      toast.success('Reassigned successfully.'); setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
    finally { setSaving(false); }
  }

  async function handleUpdateRemark(e) {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      if (statusUpdate)   fd.append('status',          statusUpdate);
      if (remarkStudent)  fd.append('remark_student',  remarkStudent);
      if (remarkInternal) fd.append('remark_internal', remarkInternal);
      if (studentFile)    fd.append('faculty_file',    studentFile);
      if (internalFile)   fd.append('internal_file',   internalFile);
      await api.put(`/grievances/${selected.grievance_id}/update`, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      toast.success('Updated.'); setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
    finally { setSaving(false); }
  }

  async function handleCreateInternal(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/grievances/internal', intForm);
      toast.success('Internal task created.'); setShowInternal(false);
      setIntForm({ title:'', description:'', faculty_id:'' }); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
    finally { setSaving(false); }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await api.get(`/reports/export?year=${reportYear}`, { responseType:'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url;
      a.download = `Grievance_Report_${reportYear}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel report downloaded!');
    } catch { toast.error('Export failed.'); }
    finally { setExporting(false); }
  }

  const filtered = grievances.filter(g =>
    (!filterStatus || g.status === filterStatus) &&
    (!filterSource || g.source === filterSource)
  );

  const stats = {
    total:      grievances.length,
    submitted:  grievances.filter(g => g.status === 'Submitted').length,
    inProgress: grievances.filter(g => g.status === 'In Progress').length,
    resolved:   grievances.filter(g => g.status === 'Resolved').length,
  };

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card blue">
          <div className="stat-label">Total Grievances</div>
          <div className="stat-value">{stats.total}</div>
          <FiFileText className="stat-icon" />
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Pending Assignment</div>
          <div className="stat-value">{stats.submitted}</div>
          <FiClock className="stat-icon" />
        </div>
        <div className="stat-card" style={{ borderLeft:'4px solid var(--blue-400)' }}>
          <div className="stat-label">In Progress</div>
          <div className="stat-value" style={{ color:'var(--blue-500)' }}>{stats.inProgress}</div>
          <FiRefreshCw className="stat-icon" />
        </div>
        <div className="stat-card green">
          <div className="stat-label">Resolved</div>
          <div className="stat-value">{stats.resolved}</div>
          <FiCheckCircle className="stat-icon" />
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab==='grievances'?'active':''}`} onClick={() => setTab('grievances')}>
          Grievances <span className="tab-badge">{grievances.length}</span>
        </button>
        <button className={`tab-btn ${tab==='reports'?'active':''}`} onClick={() => setTab('reports')}>
          <MdBarChart style={{ verticalAlign:'middle', marginRight:4 }} /> Reports
        </button>
      </div>

      {tab === 'grievances' && (
        <div className="card">
          <div className="card-header">
            <h3>All Grievances</h3>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={load}><FiRefreshCw /></button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowInternal(true)}>
                <FiPlus /> Internal Task
              </button>
            </div>
          </div>

          <div className="filter-bar">
            <label>Status:</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option>Submitted</option><option>Assigned</option>
              <option>In Progress</option><option>Resolved</option><option>Closed</option>
            </select>
            <label>Source:</label>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}>
              <option value="">All</option>
              <option value="Google Form">Google Form</option>
              <option value="Portal">Portal</option>
              <option value="Internal">Internal</option>
            </select>
          </div>

          {loading ? <div className="spinner" /> : filtered.length === 0 ? (
            <div className="empty-state"><FiInbox className="empty-icon" /><p>No grievances found.</p></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>#</th><th>Title</th><th>Student</th><th>Source</th><th>Status</th><th>Faculty</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(g => (
                    <tr key={g.grievance_id}>
                      <td><strong>#{g.grievance_id}</strong></td>
                      <td>
                        <div style={{ fontWeight:600 }}>{g.title}</div>
                        <div style={{ fontSize:12, color:'var(--slate-500)' }}>{g.description?.substring(0,45)}...</div>
                      </td>
                      <td>
                        <div style={{ fontWeight:500 }}>{g.student_name || g.creator_name}</div>
                        <div style={{ fontSize:12, color:'var(--slate-500)' }}>{g.program_name}</div>
                      </td>
                      <td><StatusBadge source={g.source} /></td>
                      <td><StatusBadge status={g.status} /></td>
                      <td style={{ fontSize:13 }}>
                        {g.faculty_name ? `Prof. ${g.faculty_name}` : <span style={{ color:'var(--slate-400)' }}>—</span>}
                      </td>
                      <td style={{ fontSize:12, color:'var(--slate-500)' }}>
                        {new Date(g.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
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

      {tab === 'reports' && (
        <div className="card">
          <div className="card-header">
            <h3>Monthly Grievance Report</h3>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <select value={reportYear} onChange={e => setReportYear(parseInt(e.target.value))}
                style={{ padding:'7px 12px', border:'1.5px solid var(--slate-200)', borderRadius:'var(--radius-md)', fontSize:13 }}>
                {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleExportExcel} disabled={exporting}>
                <FiDownload /> {exporting ? 'Exporting...' : 'Download Excel'}
              </button>
            </div>
          </div>
          <div className="card-body">
            {/* Summary Cards */}
            {summary && (
              <div className="stat-grid" style={{ marginBottom:24 }}>
                <div className="stat-card blue"><div className="stat-label">Total</div><div className="stat-value">{summary.total}</div></div>
                <div className="stat-card amber"><div className="stat-label">Pending</div><div className="stat-value">{summary.submitted}</div></div>
                <div className="stat-card" style={{ borderLeft:'4px solid var(--blue-400)' }}><div className="stat-label">In Progress</div><div className="stat-value" style={{ color:'var(--blue-500)' }}>{summary.in_progress}</div></div>
                <div className="stat-card green"><div className="stat-label">Resolved</div><div className="stat-value">{summary.resolved}</div></div>
              </div>
            )}

            {reportLoading ? <div className="spinner" /> : (
              <div className="table-container">
                <table className="table report-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Month</th>
                      <th className="col-resolved" style={{ textAlign:'center' }}>Total</th>
                      <th className="col-pending"  style={{ textAlign:'center' }}>Pending</th>
                      <th style={{ textAlign:'center' }}>Assigned</th>
                      <th style={{ textAlign:'center' }}>In Progress</th>
                      <th className="col-resolved" style={{ textAlign:'center' }}>Resolved</th>
                      <th style={{ textAlign:'center' }}>Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((row, i) => (
                      <tr key={row.month}>
                        <td style={{ color:'var(--slate-400)' }}>{i+1}</td>
                        <td style={{ fontWeight:600 }}>{row.month_name?.trim()}</td>
                        <td className="report-cell-total"  style={{ textAlign:'center' }}>{row.total}</td>
                        <td className="report-cell-pending" style={{ textAlign:'center' }}>{row.submitted}</td>
                        <td style={{ textAlign:'center' }}>{row.assigned}</td>
                        <td style={{ textAlign:'center' }}>{row.in_progress}</td>
                        <td className="report-cell-resolved" style={{ textAlign:'center' }}>{row.resolved}</td>
                        <td style={{ textAlign:'center', color:'var(--slate-500)' }}>{row.closed}</td>
                      </tr>
                    ))}
                    {/* Summary row */}
                    <tr className="report-summary-row">
                      <td></td><td>TOTAL</td>
                      {['total','submitted','assigned','in_progress','resolved','closed'].map(k => (
                        <td key={k} style={{ textAlign:'center' }}>
                          {monthly.reduce((s,r) => s + (parseInt(r[k])||0), 0)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grievance Detail / Manage Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth:700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>#{selected.grievance_id} — {selected.title}</h3>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <StatusBadge status={selected.status} />
                  <StatusBadge source={selected.source} />
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelected(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:14, color:'var(--slate-600)', marginBottom:12 }}>{selected.description}</p>

              {selected.source !== 'Internal' && (
                <div style={{ background:'var(--blue-50)', borderRadius:'var(--radius-md)', padding:'10px 14px', marginBottom:16, fontSize:13 }}>
                  <strong>Student:</strong> {selected.student_name} · {selected.student_email}<br />
                  <strong>Program:</strong> {selected.program_name} · <strong>Adm. No:</strong> {selected.admission_no}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {selected.file_url && (
                  <a href={formatFileUrl(selected.file_url)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                    <FiPaperclip /> Student Attachment
                  </a>
                )}
                {selected.faculty_file_url && (
                  <a href={formatFileUrl(selected.faculty_file_url)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--green-600)', color: 'var(--green-700)' }}>
                    <FiPaperclip /> Student Response Doc
                  </a>
                )}
                {selected.internal_file_url && (
                  <a href={formatFileUrl(selected.internal_file_url)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--purple-600)', color: 'var(--purple-700)' }}>
                    <FiPaperclip /> Internal Staff Doc (Private)
                  </a>
                )}
              </div>

              {/* Assign Faculty */}
              {!selected.assigned_to && (
                <div style={{ marginBottom:20 }}>
                  <h4 style={{ marginBottom:8 }}>Assign to Faculty</h4>
                  <div style={{ display:'flex', gap:8 }}>
                    <select className="form-control" value={assignFacultyId} onChange={e => setAssignFacultyId(e.target.value)}>
                      <option value="">Select faculty...</option>
                      {faculty.filter(f => f.is_active).map(f => (
                        <option key={f.user_id} value={f.user_id}>Prof. {f.name} ({f.department})</option>
                      ))}
                    </select>
                    <button className="btn btn-primary" onClick={handleAssignFaculty} disabled={saving}>Assign</button>
                  </div>
                </div>
              )}

              {/* Reassign Faculty */}
              {selected.assigned_to && selected.status !== 'Resolved' && (
                <div style={{ marginBottom:20 }}>
                  <h4 style={{ marginBottom:8 }}>
                    Currently: <span style={{ color:'var(--blue-700)' }}>Prof. {selected.faculty_name}</span>
                    <span style={{ fontSize:12, fontWeight:400, color:'var(--slate-500)', marginLeft:8 }}>· Reassign to:</span>
                  </h4>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <select className="form-control" value={reassignFacultyId} onChange={e => setReassignFacultyId(e.target.value)}>
                      <option value="">Select new faculty...</option>
                      {faculty.filter(f => f.is_active && f.user_id !== selected.assigned_to).map(f => (
                        <option key={f.user_id} value={f.user_id}>Prof. {f.name}</option>
                      ))}
                    </select>
                    <input className="form-control" placeholder="Reason (optional)"
                      value={reassignReason} onChange={e => setReassignReason(e.target.value)} />
                    <button className="btn btn-secondary" onClick={handleReassign} disabled={saving}>Reassign</button>
                  </div>
                </div>
              )}

              {/* Remarks */}
              <form onSubmit={handleUpdateRemark}>
                <div style={{ borderTop:'1px solid var(--slate-200)', paddingTop:16, marginTop:8 }}>
                  <h4 style={{ marginBottom:12 }}>Update Remarks & Status</h4>
                  <div className="form-group">
                    <label className="form-label">Update Status</label>
                    <select className="form-control" value={statusUpdate} onChange={e => setStatusUpdate(e.target.value)}>
                      <option value="">-- No change --</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                  {selected.source !== 'Internal' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Student Remark <span style={{ color:'var(--amber-600)', fontSize:11 }}>(Emailed to student)</span></label>
                        <textarea className="form-control" rows={3} placeholder="Message visible to student..."
                          value={remarkStudent} onChange={e => setRemarkStudent(e.target.value)} />
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
                            <button type="button" onClick={() => setStudentFile(null)} style={{ background: 'none', border: 'none', color: 'var(--red-600)', cursor: 'pointer', fontWeight: 'bold' }}>Remove</button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <div className="form-group">
                    <label className="form-label">Internal Remark <span style={{ color:'var(--slate-400)', fontSize:11 }}>(Staff only - Private)</span></label>
                    <textarea className="form-control" rows={2} placeholder="Internal notes..."
                      value={remarkInternal} onChange={e => setRemarkInternal(e.target.value)} />
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
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>

              {/* History */}
              {history.length > 0 && (
                <div style={{ marginTop:20, borderTop:'1px solid var(--slate-200)', paddingTop:16 }}>
                  <h4 style={{ marginBottom:12, display:'flex', alignItems:'center', gap:8 }}><FiClock /> History</h4>
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

      {/* Internal Task Modal */}
      {showInternal && (
        <div className="modal-overlay" onClick={() => setShowInternal(false)}>
          <div className="modal" style={{ maxWidth:500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Internal Task</h3>
              <button className="btn-icon" onClick={() => setShowInternal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreateInternal}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Title *</label>
                  <input className="form-control" required placeholder="e.g. Check student fees record"
                    value={intForm.title} onChange={e => setIntForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Task Description *</label>
                  <textarea className="form-control" required rows={4}
                    placeholder="Detailed instructions..."
                    value={intForm.description} onChange={e => setIntForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign To Faculty *</label>
                  <select className="form-control" required value={intForm.faculty_id}
                    onChange={e => setIntForm(f => ({ ...f, faculty_id: e.target.value }))}>
                    <option value="">Select faculty...</option>
                    {faculty.filter(f => f.is_active).map(f => (
                      <option key={f.user_id} value={f.user_id}>Prof. {f.name} ({f.department})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInternal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiEye, FiEyeOff, FiInfo } from 'react-icons/fi';
import { MdSchool } from 'react-icons/md';

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [forgot, setForgot]   = useState(false);
  const [fpStep, setFpStep]   = useState(1);
  const [fpData, setFpData]   = useState({ email:'', otp:'', new_password:'' });

  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      if (res.data.user.role === 'Student') {
        toast.error('Students track grievances directly via email notifications.');
        return;
      }
      login(res.data.token, res.data.user);
      toast.success(`Welcome, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed.');
    } finally { setLoading(false); }
  }

  async function sendForgotOTP(e) {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: fpData.email });
      toast.success('OTP sent to your email.'); setFpStep(2);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to send OTP.'); }
    finally { setLoading(false); }
  }

  async function verifyForgotOTP(e) {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email: fpData.email, otp: fpData.otp });
      toast.success('OTP verified.'); setFpStep(3);
    } catch (err) { toast.error(err.response?.data?.error || 'Invalid OTP.'); }
    finally { setLoading(false); }
  }

  async function resetPassword(e) {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/auth/reset-password', { email: fpData.email, otp: fpData.otp, new_password: fpData.new_password });
      toast.success('Password reset! Please sign in.'); setForgot(false); setFpStep(1);
    } catch (err) { toast.error(err.response?.data?.error || 'Reset failed.'); }
    finally { setLoading(false); }
  }

  const collegeName = import.meta.env.VITE_COLLEGE_NAME || 'College Grievance Portal';

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <h1><MdSchool style={{ verticalAlign: 'middle', marginRight: 6 }} />{collegeName}</h1>
          <p>{forgot ? 'Reset Password' : 'Staff Portal Sign In (Dean / HOD / Faculty)'}</p>
        </div>

        {!forgot ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Official Email Address</label>
              <div style={{ position:'relative' }}>
                <FiMail style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--slate-400)' }} />
                <input className="form-control" style={{ paddingLeft:36 }} type="email" required
                  placeholder="name@college.edu" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position:'relative' }}>
                <FiLock style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--slate-400)' }} />
                <input className="form-control" style={{ paddingLeft:36, paddingRight:36 }}
                  type={showPwd ? 'text' : 'password'} required
                  placeholder="••••••••" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--slate-400)' }}>
                  {showPwd ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width:'100%' }}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
            <div style={{ textAlign:'center', marginTop:16 }}>
              <button type="button" onClick={() => setForgot(true)}
                style={{ background:'none', border:'none', color:'var(--blue-600)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
                Forgot password?
              </button>
            </div>
            <div style={{ background:'var(--blue-50)', border:'1px solid var(--blue-200)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginTop:24, fontSize:12, color:'var(--slate-600)' }}>
              <FiInfo style={{ verticalAlign: 'middle', marginRight: 6, color:'var(--blue-600)' }} />
              <strong>Note for Students:</strong> Submit grievances via Google Form. You will receive real-time status and faculty update emails at every stage of resolution.
            </div>
          </form>
        ) : (
          <>
            {fpStep === 1 && (
              <form onSubmit={sendForgotOTP}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-control" type="email" required placeholder="your@college.edu"
                    value={fpData.email} onChange={e => setFpData(d => ({ ...d, email: e.target.value }))} />
                </div>
                <button className="btn btn-primary" style={{ width:'100%' }} disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset OTP'}
                </button>
              </form>
            )}
            {fpStep === 2 && (
              <form onSubmit={verifyForgotOTP}>
                <p style={{ fontSize:13, color:'var(--slate-600)', marginBottom:16 }}>OTP sent to <strong>{fpData.email}</strong></p>
                <div className="form-group">
                  <label className="form-label">Enter OTP</label>
                  <input className="form-control" type="text" maxLength={6} required placeholder="6-digit OTP"
                    value={fpData.otp} onChange={e => setFpData(d => ({ ...d, otp: e.target.value }))} />
                </div>
                <button className="btn btn-primary" style={{ width:'100%' }} disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
            )}
            {fpStep === 3 && (
              <form onSubmit={resetPassword}>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-control" type="password" required minLength={6} placeholder="New password"
                    value={fpData.new_password} onChange={e => setFpData(d => ({ ...d, new_password: e.target.value }))} />
                </div>
                <button className="btn btn-primary" style={{ width:'100%' }} disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}
            <div style={{ textAlign:'center', marginTop:16 }}>
              <button onClick={() => { setForgot(false); setFpStep(1); }}
                style={{ background:'none', border:'none', color:'var(--blue-600)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
                ← Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

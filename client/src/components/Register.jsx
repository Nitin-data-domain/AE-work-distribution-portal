import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name:'', email:'', phone:'', program_name:'', password:'', otp:'' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function sendOTP(e) {
    e.preventDefault();
    if (!form.email) return toast.error('Enter your email first.');
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { email: form.email });
      toast.success('OTP sent to your email!'); setStep(2);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to send OTP.'); }
    finally { setLoading(false); }
  }

  async function handleRegister(e) {
    e.preventDefault(); setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      login(res.data.token, res.data.user);
      toast.success('Account created! Welcome.'); navigate('/dashboard');
    } catch (err) { toast.error(err.response?.data?.error || 'Registration failed.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>🎓 Student Registration</h1>
          <p>Create your grievance portal account</p>
        </div>

        {step === 1 ? (
          <form onSubmit={sendOTP}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-control" required placeholder="Your full name"
                  value={form.name} onChange={e => upd('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" placeholder="+91..."
                  value={form.phone} onChange={e => upd('phone', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-control" type="email" required placeholder="your@email.com"
                value={form.email} onChange={e => upd('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Program / Department</label>
              <input className="form-control" placeholder="e.g. Computer Science, BBA"
                value={form.program_name} onChange={e => upd('program_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-control" type="password" required minLength={6} placeholder="Min. 6 characters"
                value={form.password} onChange={e => upd('password', e.target.value)} />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width:'100%' }}>
              {loading ? 'Sending OTP...' : 'Send Verification OTP'}
            </button>
            <div style={{ textAlign:'center', marginTop:16, fontSize:14 }}>
              Already have an account? <Link to="/login" style={{ color:'var(--blue-600)', fontWeight:600 }}>Sign in</Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div style={{ background:'var(--blue-50)', border:'1px solid var(--blue-200)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:20, fontSize:13 }}>
              ✉️ OTP sent to <strong>{form.email}</strong>
            </div>
            <div className="form-group">
              <label className="form-label">Enter 6-digit OTP *</label>
              <input className="form-control" required maxLength={6} placeholder="______"
                style={{ fontSize:24, letterSpacing:8, textAlign:'center' }}
                value={form.otp} onChange={e => upd('otp', e.target.value)} />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width:'100%' }}>
              {loading ? 'Creating account...' : 'Verify & Register'}
            </button>
            <div style={{ textAlign:'center', marginTop:12 }}>
              <button type="button" onClick={() => setStep(1)}
                style={{ background:'none', border:'none', color:'var(--blue-600)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
                ← Change email / resend OTP
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

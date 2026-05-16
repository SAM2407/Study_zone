import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import '../assets/styles/signup.css';

const Signup = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(600);
    const [timerActive, setTimerActive] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        let interval;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft <= 0) {
            setTimerActive(false);
        }
        return () => clearInterval(interval);
    }, [timerActive, timeLeft]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');

        const emailRegex = /^[a-zA-Z0-9._%+-]{2,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(formData.email)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            await authService.sendOTP({
                name: formData.name,
                email: formData.email,
                password: formData.password
            });
            setStep(2);
            setTimeLeft(600);
            setTimerActive(true);
        } catch (err) {
            setError(err || "Could not send OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');

        if (otp.length !== 6) {
            setError("Please enter the 6-digit OTP.");
            return;
        }

        setLoading(true);
        try {
            const data = await authService.verifyOTP({ email: formData.email, otp });
            
            const token = data.data?.token || data.token;
            const user = data.data?.user || data.user;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem("loginTime", Date.now().toString());
            localStorage.setItem("sessionDuration", "1");

            alert("✅ Email verified! Account created successfully.");
            navigate('/');
            window.location.reload();
        } catch (err) {
            setError(err || "Invalid OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setError('');
        try {
            await authService.resendOTP({ email: formData.email });
            const errorEl = document.getElementById("otpError");
            if (errorEl) {
                errorEl.style.color = "green";
                errorEl.textContent = "✅ New OTP sent!";
            }
            setTimeLeft(600);
            setTimerActive(true);
            setTimeout(() => {
                if (errorEl) {
                    errorEl.textContent = "";
                    errorEl.style.color = "red";
                }
            }, 3000);
        } catch (err) {
            setError("Could not resend OTP.");
        }
    };

    return (
        <div>
            <h1>WELCOME TO STUDY ZONE</h1>
            <div className="container">
                <div className="form-box">
                    {step === 1 ? (
                        <div id="signupStep">
                            <h2>Sign Up</h2>
                            <form id="signupForm" onSubmit={handleSendOTP}>
                                <div className="input">
                                    <input type="text" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div className="input">
                                    <input type="email" placeholder="Email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                </div>
                                <div className="input">
                                    <input type="password" placeholder="Password (min 6 chars)" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                                </div>
                                <div className="input">
                                    <input type="password" placeholder="Confirm Password" required value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                                </div>
                                <button type="submit" className="btn" disabled={loading}>
                                    {loading ? 'Sending OTP...' : 'Send OTP'}
                                </button>
                                <p className="toggle-text">Already have an account? <Link to="/login">Login</Link></p>
                            </form>
                            {error && <div id="signupError" style={{color: 'red', fontSize: '13px', textAlign: 'center', marginTop: '8px'}}>{error}</div>}
                        </div>
                    ) : (
                        <div id="otpStep">
                            <h2>Verify Email</h2>
                            <p style={{color:'#aaa', fontSize:'13px', textAlign:'center', marginBottom:'15px'}}>
                                We sent a 6-digit OTP to <strong style={{color:'#ffcc00'}}>{formData.email}</strong>
                            </p>
                            <form id="otpForm" onSubmit={handleVerifyOTP}>
                                <div className="input">
                                    <input type="text" placeholder="Enter 6-digit OTP" maxLength="6" style={{textAlign:'center', fontSize:'22px', letterSpacing:'8px'}} required value={otp} onChange={e => setOtp(e.target.value)} />
                                </div>
                                <button type="submit" className="btn" disabled={loading}>
                                    {loading ? 'Verifying...' : 'Verify & Create Account'}
                                </button>
                            </form>
                            <p style={{textAlign:'center', marginTop:'12px'}}>
                                <button onClick={handleResendOTP} className="resend-btn" style={{background:'none', border:'none', color:'rgb(247, 160, 67)', cursor:'pointer', textDecoration:'underline'}}>🔄 Resend OTP</button>
                            </p>
                            <div id="otpTimer" style={{color: timeLeft === 0 ? 'red' : '#aaa', fontSize:'13px', textAlign:'center', marginTop:'8px'}}>
                                {timeLeft > 0 ? `OTP expires in ${formatTime(timeLeft)}` : "⚠️ OTP expired. Please resend."}
                            </div>
                            {error && <div id="otpError" style={{color: 'red', fontSize: '13px', textAlign: 'center', marginTop: '8px'}}>{error}</div>}
                            <p style={{textAlign:'center', marginTop:'12px'}}>
                                <button onClick={() => { setStep(1); setTimerActive(false); setOtp(''); setError(''); }} style={{color:'rgb(247,160,67)', fontSize:'13px', background:'none', border:'none', cursor:'pointer'}}>← Change email</button>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Signup;

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import '../assets/styles/login.css';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (!formData.password) {
            setError("Please enter your password.");
            return;
        }

        setLoading(true);
        try {
            const result = await authService.login(formData);
            
            const token = result.data?.token || result.token;
            const user = result.data?.user || result.user;

            if (!token) {
                setError("Login error. Please try again.");
                setLoading(false);
                return;
            }

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem("loginTime", Date.now().toString());
            localStorage.setItem("sessionDuration", formData.rememberMe ? "7" : "1");

            alert("Login successful!");
            navigate('/');
            window.location.reload(); 
        } catch (err) {
            setError(err || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>WELCOME TO STUDY ZONE</h1>
            <div className="container">
                <div className="form-box">
                    <h2>Login</h2>
                    {error && (
                        <p id="errorMsg" style={{ color: "red", fontSize: "13px", textAlign: "center", marginTop: "8px" }}>
                            {error}
                        </p>
                    )}
                    <form id="loginForm" onSubmit={handleSubmit}>
                        <div className="input">
                            <input 
                                type="email" 
                                id="email" 
                                placeholder="Email" 
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div className="input">
                            <input 
                                type="password" 
                                id="password" 
                                placeholder="Password" 
                                required
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                        <div className="remember-row">
                            <label className="remember-label">
                                <input 
                                    type="checkbox" 
                                    id="rememberMe"
                                    checked={formData.rememberMe}
                                    onChange={(e) => setFormData({...formData, rememberMe: e.target.checked})}
                                /> Remember me for 7 days
                            </label>
                        </div>
                        <button type="submit" className="btn" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                        <p className="toggle-text">
                            <Link to="/forgot-password">Forgot Password?</Link>
                        </p>
                        <p className="toggle-text">
                            Don't have an account? <Link to="/signup">Sign Up</Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;


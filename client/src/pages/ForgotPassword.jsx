import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';
import '../assets/styles/login.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await authService.forgotPassword({ email });
            setSuccess(true);
        } catch (err) {
            setError(err || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>Study Zone Password Recovery</h1>
            <div className="container">
                <div className="form-box">
                    <h2>Reset Password</h2>
                    {success ? (
                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <h3 style={{ color: 'green' }}>Check your email</h3>
                            <p>We've sent a password reset link to<br/><strong>{email}</strong></p>
                            <p className="toggle-text" style={{ marginTop: '20px' }}>
                                <Link to="/login">← Back to Login</Link>
                            </p>
                        </div>
                    ) : (
                        <>
                            <p style={{ textAlign: 'center', fontSize: '14px', marginBottom: '15px' }}>
                                Enter your email and we'll send you a link to reset your password.
                            </p>
                            {error && (
                                <p id="errorMsg" style={{ color: "red", fontSize: "13px", textAlign: "center", marginTop: "8px" }}>
                                    {error}
                                </p>
                            )}
                            <form onSubmit={handleSubmit}>
                                <div className="input">
                                    <input 
                                        type="email" 
                                        placeholder="name@example.com" 
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <button type="submit" className="btn" disabled={loading}>
                                    {loading ? 'Sending link...' : 'Send Reset Link'}
                                </button>
                                <p className="toggle-text">
                                    <Link to="/login">Back to login</Link>
                                </p>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import '../assets/styles/login.css';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    useEffect(() => {
        if (!token || !email) {
            setError('Invalid or expired reset link.');
        }
    }, [token, email]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await authService.resetPassword({ email, token, newPassword });
            setSuccess(true);
        } catch (err) {
            setError(err || 'Failed to reset password. The link may have expired.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>Study Zone Password Recovery</h1>
            <div className="container">
                <div className="form-box">
                    <h2>New Password</h2>
                    {success ? (
                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <h3 style={{ color: 'green' }}>Password Reset!</h3>
                            <p>You can now sign in with your new password.</p>
                            <p className="toggle-text" style={{ marginTop: '20px' }}>
                                <Link to="/login" className="btn" style={{ display: 'block', textDecoration: 'none' }}>Sign In Now</Link>
                            </p>
                        </div>
                    ) : (
                        <>
                            <p style={{ textAlign: 'center', fontSize: '14px', marginBottom: '15px' }}>
                                Please set a strong, secure password for your account.
                            </p>
                            {error && (
                                <p id="errorMsg" style={{ color: "red", fontSize: "13px", textAlign: "center", marginTop: "8px" }}>
                                    {error}
                                </p>
                            )}
                            <form onSubmit={handleSubmit}>
                                <div className="input">
                                    <input 
                                        type="password" 
                                        placeholder="New Password" 
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>
                                <div className="input">
                                    <input 
                                        type="password" 
                                        placeholder="Confirm New Password" 
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                                <button type="submit" className="btn" disabled={loading || !token}>
                                    {loading ? 'Resetting Password...' : 'Reset Password'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;

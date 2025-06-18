import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin } from '../api';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = await apiLogin({ email, password });

            if (data.accessToken && data.userId) {
                // Save only access token (in memory/localStorage)
                login({ token: data.accessToken, userId: data.userId });
                navigate('/');
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (err) {
            alert(err.message || 'An error occurred during login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <h1>Log in to your account</h1>
            <span>Welcome back! Please enter your details</span>
            <form onSubmit={handleSubmit}>
                <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    required
                />
                <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Password"
                    required
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </>
    );
};

export default Login;

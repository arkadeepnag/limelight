import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../api';

const Register = () => {
    const [username, setUsername] = useState('');
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [about, setAbout] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [strength, setStrength] = useState('');
    const navigate = useNavigate();

    // Fetch user country by IP on mount
    useEffect(() => {
        fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => {
                if (data && data.country_name) {
                    setLocation(data.country_name);
                }
            })
            .catch(err => {
                console.error('Failed to get location:', err);
            });
    }, []);

    const checkPasswordStrength = (pass) => {
        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[a-z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        switch (score) {
            case 5: return 'Very Strong';
            case 4: return 'Strong';
            case 3: return 'Medium';
            default: return 'Weak';
        }
    };

    const handlePasswordChange = (e) => {
        const val = e.target.value;
        setPassword(val);
        setStrength(checkPasswordStrength(val));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (strength !== 'Very Strong') {
            alert('Password must be very strong!');
            return;
        }

        const data = await register({
            username, name, location, about, email, password
        });

        if (data.message === 'User registered successfully') navigate('/login');
        else alert(data.message);
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name (optional)" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
            <textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="About (optional)" rows={3} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
            <input value={password} onChange={handlePasswordChange} type="password" placeholder="Password" required />
            <span style={{ color: strength === 'Very Strong' ? 'green' : 'orange' }}>Password Strength: {strength}</span>
            <button type="submit" disabled={strength !== 'Very Strong'}>Register</button>
        </form>
    );
};

export default Register;

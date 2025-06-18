import React, { useEffect, useState } from 'react';
import { getSubscriptions } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const SubscriptionsPage = () => {
    const { auth } = useAuth();
    const navigate = useNavigate();
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth?.userId || !auth?.token) return;

        const fetchSubscriptions = async () => {
            try {
                const subs = await getSubscriptions(auth.userId, auth.token);
                setSubscriptions(subs);
            } catch (err) {
                console.error('Failed to load subscriptions:', err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSubscriptions();
    }, [auth]);

    if (loading) return <div>Loading subscriptions...</div>;

    return (
        <div className="subscriptions-page">
            <h2>Subscribed Channels</h2>
            {subscriptions.length === 0 ? (
                <p>You haven't subscribed to any channels yet.</p>
            ) : (
                <ul className="subscription-list">
                    {subscriptions.map(channel => (
                        <li
                            key={channel._id}
                            className="subscription-item"
                            onClick={() => navigate(`/channel/${channel._id}`)}
                            style={{
                                cursor: 'pointer',
                                marginBottom: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                        >
                            <img
                                src={channel.profilePicture || '/default-profile.png'}
                                alt={`${channel.username}'s profile`}
                                style={{ width: '48px', height: '48px', borderRadius: '50%' }}
                            />
                            <div>
                                <h3>{channel.username}</h3>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SubscriptionsPage;

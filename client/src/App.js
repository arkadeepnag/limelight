import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Upload from './pages/Upload';
import VideoPage from './pages/VideoPage';
import SearchResults from './pages/SearchResults';
import Channel from './pages/Channel';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';
import WatchHistory from './pages/watchHistory';
import SubscriptionsPage from './pages/SubscriptionsPage';
const App = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <>
      {!isAuthPage && <Navbar />}
      {!isAuthPage && <Sidebar />}

      {isAuthPage ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      ) : (
        <main className="mainComponent">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
            <Route path="/video/:id" element={<ProtectedRoute><VideoPage /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
            <Route path="/channel/:userId" element={<ProtectedRoute><Channel /></ProtectedRoute>} />
            <Route path="/subscriptions" element={<ProtectedRoute><SubscriptionsPage /></ProtectedRoute>} />

            <Route path="/library" element={<ProtectedRoute><WatchHistory /></ProtectedRoute>} />
          </Routes>
        </main>
      )}
    </>
  );
};

export default App;

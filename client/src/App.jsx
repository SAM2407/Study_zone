import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ExploreGroups = lazy(() => import('./pages/ExploreGroups'));
const CreateGroup = lazy(() => import('./pages/CreateGroup'));
const Resources = lazy(() => import('./pages/Resources'));
const StudyPlanner = lazy(() => import('./pages/StudyPlanner'));
const JoinMeeting = lazy(() => import('./pages/JoinMeeting'));
const JoinMeetingLobby = lazy(() => import('./pages/JoinMeetingLobby'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div style={{ width: 48, height: 48, border: '4px solid #e5e7eb', borderTop: '4px solid #4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
  </div>
);

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>

        {/* ── Meeting page: NO Layout (fullscreen, no navbar/footer) ── */}
        <Route path="/meeting/:meetingId" element={
          <ProtectedRoute>
            <JoinMeeting />
          </ProtectedRoute>
        } />

        {/* ── All other pages: wrapped in Layout (with Navbar + Footer) ── */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/explore" element={<ExploreGroups />} />
              <Route path="/join-meeting" element={<ProtectedRoute><JoinMeetingLobby /></ProtectedRoute>} />
              <Route path="/contact" element={<ContactUs />} />
              <Route path="/create-group" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
              <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
              <Route path="/planner" element={<ProtectedRoute><StudyPlanner /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        } />

      </Routes>
    </Suspense>
  );
}

export default App;

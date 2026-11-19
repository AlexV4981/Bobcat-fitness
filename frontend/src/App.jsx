import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import HomePage from './HomePage';
import Sidebar from './components/HomePage/Sidebar';
import LoginPage from './LoginPage';
import ProfilePage from './ProfilePage';
import WorkoutSchedulePage from "./WorkoutSchedule/WorkoutSchedulePage";
import ExercisesPage from "./Exercises/ExercisesPage";
import CameraPage from './Camera/CameraPage';
import AboutUsPage from './AboutUsPage';
import AIDietingPage from './AIDieting/AIDietingPage'; 
import AIWorkoutPage from './AIWorkout/AIWorkoutPage';
import './App.css';
import { isSyntheticEmail } from './services/authService';
import { updateProfile, uploadAvatar, parseHeight, formatHeight, parseWeight } from './services/profileService';

const DEFAULTS = { weight: '165', height: "5'10", goal: 'Build Endurance' };

export default function App() {
  const { user: authUser, profile, isGuest, isLoggedIn, loading,
        signIn, signUp, signOut, linkEmail, continueAsGuest, refreshProfile } = useAuth();

  const [authError, setAuthError] = useState('');
  const [page, setPage] = useState('profile');
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const handleSaveSet = (record) => setWorkoutHistory((prev) => [record, ...prev]);

  // Set when the Workouts tab redirects to the AI Workout page: { id, mode: 'view' | 'edit' }.
  // Any normal navigation clears it, so the sidebar's "AI Workout" opens a fresh generator.
  const [workoutIntent, setWorkoutIntent] = useState(null);
  const navigate = (next) => {
    setWorkoutIntent(null);
    setPage(next);
  };
  const openWorkout = (id, mode = 'view') => {
    setWorkoutIntent({ id, mode });
    setPage('ai-workout');
  };

  // same `user` shape your pages already consume
  const domain = import.meta.env.VITE_AUTH_EMAIL_DOMAIN
  const authEmail = authUser?.email ?? ''
  const user = {
    username: isGuest ? 'Guest' : (profile?.username ?? ''),
    isLoggedIn,
    isGuest,
    email: isSyntheticEmail(authEmail) ? '' : authEmail,
    pendingEmail: authUser?.new_email ?? '',
    profileImage: profile?.avatar_url ?? null,
    weight: profile?.weight_lbs != null ? String(profile.weight_lbs) : DEFAULTS.weight,
    height: profile?.height_in != null ? formatHeight(profile.height_in) : DEFAULTS.height,
    goal: profile?.goal ?? DEFAULTS.goal,
  }

  const handleLoginSubmit = async (username, password, isRegistering) => {
    setAuthError('');
    try {
      if (isRegistering) await signUp(username, password);
      else await signIn(username, password);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleGuest = () => { setAuthError(''); continueAsGuest(); };

  const handleLogout = async () => {
    await signOut();
    navigate('home');
  };

  const handleSaveProfile = async ({ username, weight, height, goal }) => {
    await updateProfile(authUser.id, {
      username,
      weight_lbs: parseWeight(weight),
      height_in: parseHeight(height),
      goal,
    });
    await refreshProfile();
  };

  const handleUploadAvatar = async (file) => {
    const url = await uploadAvatar(authUser.id, file);
    await updateProfile(authUser.id, { avatar_url: url });
    await refreshProfile();
  };

  if (loading) return null; // or a splash screen
  if (!user.isLoggedIn) {
    return (
      <LoginPage
        onLoginSubmit={handleLoginSubmit}
        onGuestAccess={handleGuest}
        errorMessage={authError}
        clearError={() => setAuthError('')}
      />
    );
  }
  
   /*
   * ROUTING & TEMPLATE RENDERING: So this serves as the main interface routing layer. It restricts access if the user
   * is unauthenticated, handles a structured layout framework with sidebar navigation when jumping to the home or profile page, 
   * and essentially falls back to the main home page as the default view.
   */
  if (page === 'camera') {
    return (
      <div className="home">
        <Sidebar activePage="camera" onNavigate={navigate} onLogout={handleLogout} />
        <main className="content">
          <CameraPage history={workoutHistory} onSaveSet={handleSaveSet} onNavigate={navigate} />
        </main>
      </div>
    );
  }
  if (page === 'workouts') {
    return (
      <div className="home">
        <Sidebar activePage="workouts" onNavigate={navigate} onLogout={handleLogout} />
        <main className="content">
          <WorkoutSchedulePage
            onOpenWorkout={openWorkout}
            onNavigate={navigate}
            isGuest={user.isGuest}
          />
        </main>
      </div>
    );
  }
  if (page === 'AI Dieting') {
    return (
      <div className="home">
        <Sidebar activePage="AI Dieting" onNavigate={navigate} onLogout={handleLogout} />
        <main className="content">
          <AIDietingPage userGoal={user.goal} />
        </main>
      </div>
    );
  }
  if (page === 'exercises') {
    return (
      <div className="home">
        <Sidebar activePage="exercises" onNavigate={navigate} onLogout={handleLogout} />
        <ExercisesPage />
      </div>
    );
  }
  if (page === 'ai-workout') {
    return (
      <div className="home">
        <Sidebar activePage="ai-workout" onNavigate={navigate} onLogout={handleLogout} />
        <main className="content">
          <AIWorkoutPage intent={workoutIntent} isGuest={user.isGuest} />
        </main>
      </div>
    );
  }
  if (page === 'profile') {
    return (
      <div className="home">
        <Sidebar activePage="profile" onNavigate={navigate} onLogout={handleLogout} />
        <main className="content">
          <ProfilePage
            user={user.username}
            email={user.email}
            pendingEmail={user.pendingEmail}
            onLinkEmail={linkEmail}
            isGuest={user.isGuest}
            profileImage={user.profileImage}
            weight={user.weight}
            height={user.height}
            goal={user.goal}
            onSaveProfile={handleSaveProfile}
            onUploadAvatar={handleUploadAvatar}
            onLogout={handleLogout}
          />
        </main>
      </div>
    );
  }
  if (page === 'about-us') {
    return (
      <div className="home">
        <Sidebar activePage="about-us" onNavigate={navigate} onLogout={handleLogout} />
        <AboutUsPage />
      </div>
    );
  }

  return (
    <HomePage
      userName={user.username}
      onNavigate={navigate}
      onLogout={handleLogout}
    />
  );
}




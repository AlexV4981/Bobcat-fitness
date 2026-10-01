import { useState } from 'react';
import HomePage from './HomePage';
import Sidebar from './components/Homepage/Sidebar';
import LoginPage from './LoginPage';
import ProfilePage from './ProfilePage';
import WorkoutSchedulePage from "./WorkoutSchedule/WorkoutSchedulePage";
import Dashboard from './Dashboard/DashboardPage'
import CameraPage from './Camera/CameraPage';
import './App.css';

export default function App() {
  /*
   * STATE MANAGEMENT: This section initializes the application, including a database array for 
   * the registered objects. It also sets up the active session containing the necessary credentials, 
   * wellness data, a routing tracker, and an error string to display any issues that pop up.
   */
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [user, setUser] = useState({
    username: '',
    password: '',
    isLoggedIn: false,
    isGuest: false,
    profileImage: null,
    weight: '165',
    height: "5'10",
    goal: 'Build Endurance'
  });
  
  /*
   * AUTHENTICATION HANDLERS: So this block manages identity access by processing user logins and registrations.
   * It runs duplication checks during sign-ups, validates a match on any saved credentials, 
   * checks existing records during logins, or builds a basic placeholder profile if a guest logs in.
   */
  const [page, setPage] = useState('profile');
  const [authError, setAuthError] = useState('');
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const handleSaveSet = (record) => setWorkoutHistory((prev) => [record, ...prev]);
  const handleLoginSubmit = (username, password, isRegistering) => {
    setAuthError('');
    if (isRegistering) {
      const userExists = registeredUsers.some(
        (u) => u.username.toLowerCase() === username.toLowerCase()
      );
      if (userExists) {
        setAuthError('This username is already taken!');
        return;
      }
      const newUser = { 
        username, 
        password,
        profileImage: null,
        weight: '165',
        height: "5'10",
        goal: 'Build Endurance'
      };
      setRegisteredUsers((prev) => [...prev, newUser]);
      setUser({
        ...newUser,
        isLoggedIn: true,
        isGuest: false
      });
    } else {
      const foundUser = registeredUsers.find(
        (u) => u.username.toLowerCase() === username.toLowerCase()
      );
      if (!foundUser) {
        setAuthError('Username does not exist. Please create an account first!');
        return;
      }
      if (foundUser.password !== password) {
        setAuthError('Incorrect password. Please try again.');
        return;
      }
      setUser({
        ...foundUser,
        isLoggedIn: true,
        isGuest: false
      });
    }
  };
  const handleGuest = () => {
    setAuthError('');
    setUser({
      username: 'Guest',
      password: '',
      isLoggedIn: true,
      isGuest: true,
      profileImage: null,
      weight: '165',
      height: "5'10",
      goal: 'Build Endurance'
    });
  };
  
  /*
   * DATA SYNC & LIFE CYCLE: This section updates active profiles and handles any session states.
   * It targets a mockup database format if a user were to enter the page as a guest, but it maps
   * those updates directly back into the register if a persistent account is active.
   */
  const updateUserData = (field, value) => {
    if (user.isGuest) {
      setUser(prev => ({ ...prev, [field]: value }));
      return;
    }
    setRegisteredUsers(prev => prev.map(u => 
      u.username === user.username ? { ...u, [field]: value } : u
    ));
    setUser(prev => ({ ...prev, [field]: value }));
  };
  const handleLogout = () => {
    setPage('home');
    setUser({
      username: '',
      password: '',
      isLoggedIn: false,
      isGuest: false,
      profileImage: null,
      weight: '165',
      height: "5'10",
      goal: 'Build Endurance'
    });
  };
  
   /*
   * ROUTING & TEMPLATE RENDERING: So this serves as the main interface routing layer. It restricts access if the user
   * is unauthenticated, handles a structured layout framework with sidebar navigation when jumping to the home or profile page, 
   * and essentially falls back to the main dashboard as the default view.
   */
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
  if (page === 'camera') {
    return (
      <div className="home">
        <Sidebar activePage="camera" onNavigate={setPage} onLogout={handleLogout} />
        <main className="content">
          <CameraPage history={workoutHistory} onSaveSet={handleSaveSet} />
        </main>
      </div>
    );
  }
  if (page === 'workouts') {
    return (
      <div className="home">
        <Sidebar activePage="workouts" onNavigate={setPage} onLogout={handleLogout} />
        <main className="content">
          <WorkoutSchedulePage />
        </main>
      </div>
    );
  }

  if (page === 'dashboard') {
    return (
      <div className="home">
        <Sidebar activePage="dashboard" onNavigate={setPage} onLogout={handleLogout} />
        <Dashboard />
      </div>
    );
  }
  if (page === 'profile') {
    return (
      <div className="home">
        <Sidebar activePage="profile" onNavigate={setPage} onLogout={handleLogout} />
        <main className="content">
          <ProfilePage
            user={user.username}
            isGuest={user.isGuest}
            profileImage={user.profileImage}
            weight={user.weight}
            height={user.height}
            goal={user.goal}
            onProfileUpdate={updateUserData}
            onLogout={handleLogout}
          />
        </main>
      </div>
    );
  }

  return (
    <HomePage
      userName={user.username}
      onNavigate={setPage}
      onLogout={handleLogout}
    />
  );
}

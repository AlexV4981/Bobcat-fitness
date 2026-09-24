import { useState } from 'react';
import HomePage from './HomePage';
import Sidebar from './components/Sidebar';
import LoginPage from './LoginPage';
import ProfilePage from './ProfilePage';
import './App.css';

export default function App() {
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

  const [page, setPage] = useState('profile');
  const [authError, setAuthError] = useState('');
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
  if (page === 'profile') {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#121212' }}>
      <Sidebar activePage="profile" onNavigate={setPage} />
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

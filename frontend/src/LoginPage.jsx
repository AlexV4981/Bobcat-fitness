import React, { useState } from 'react';

// =================================================================================
// 1. STATE & USER INTERACTION LOGIC:
// This first chunk of code sets up a basic memory block that the page needs to have
// while the user is interacting with it. It holds the text typed into the username 
// and password boxes, it also tracks whether the user clicked the eye icon to see their password, 
// and figures out whether to show the "Sign In" layout or the "Create Account" layout.
// =================================================================================
export default function LoginPage({ onLoginSubmit, onGuestAccess, errorMessage, clearError }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault(); 
    if (username.trim() && password.trim()) {
      onLoginSubmit(username.trim(), password.trim(), isRegistering); 
    }
  };
  const toggleMode = () => {
    clearError(); 
    setIsRegistering(!isRegistering);
  };

  return (
    // =================================================================================
    // 2. PAGE CONTAINER & WARNINGS:
    // This section builds the actual physical look of the login page, putting this page 
    // on a dark canvas. Right inside the page, it sets up an automatic warning for any mistakes:
    // if App.jsx sends down a message saying a password was wrong or a username was taken, 
    // a alert banner of some kind instantly slides into view after inserting the inputs.
    // =================================================================================
    <div style={{ 
      backgroundColor: '#121212', 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      fontFamily: 'sans-serif' 
    }}>
      <div style={{ 
        backgroundColor: '#F4F3EF', 
        padding: '40px', 
        borderRadius: '24px', 
        width: '100%', 
        maxWidth: '380px', 
        textAlign: 'center', 
        boxShadow: '0 12px 30px rgba(0,0,0,0.4)' 
      }}>
        <h2 style={{ color: '#121212', fontWeight: '700', marginBottom: '8px' }}>Bobcat Fitness</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
          {isRegistering ? 'Create your fitness account' : 'Welcome back! Please sign in.'}
        </p>
        {errorMessage && (
          <div style={{
            backgroundColor: '#FADBD8',
            color: '#C0392B',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '16px',
            textAlign: 'left',
            border: '1px solid #E6B0AA'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

    {/* // =================================================================================
        // 3. SECURE CREDENTIALS:
        // This final area generates the passwords. Each of the password block that is put
        // uses a container layout to position the eye toggle icon directly to the right 
        // of the password box. The page in particular also seamlessly shifts between "Create Account", 
        // "Sign In", and a clean guest button at the bottom depending on what you choose.
        // ================================================================================= */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#121212', display: 'block', marginBottom: '6px' }}>USERNAME</label>
            <input 
              type="text" 
              required 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="Username" 
              style={inputStyle} 
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#121212', display: 'block', marginBottom: '6px' }}>PASSWORD</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••" 
                style={{ ...inputStyle, paddingRight: '45px' }} 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#666',
                  userSelect: 'none',
                  padding: '0'
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          <button type="submit" style={{ 
            backgroundColor: '#121212', 
            color: '#FFF', 
            border: 'none', 
            padding: '14px', 
            borderRadius: '12px', 
            fontWeight: '600', 
            marginTop: '12px', 
            cursor: 'pointer' 
          }}>
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={toggleMode} 
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
          >
            {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>
          
          <div style={{ borderTop: '1px solid #DDD', paddingTop: '10px', marginTop: '5px' }}>
            <button 
              onClick={onGuestAccess} 
              style={{ 
                backgroundColor: 'transparent', 
                color: '#121212', 
                border: '2px solid #121212', 
                padding: '10px', 
                borderRadius: '12px', 
                fontWeight: '600', 
                width: '100%', 
                cursor: 'pointer' 
              }}
            >
              Browse as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Global design style used for all entry boxes
const inputStyle = { 
  width: '100%', 
  padding: '12px', 
  borderRadius: '10px', 
  border: '1px solid #CCC', 
  backgroundColor: '#FFF', 
  color: '#121212', 
  fontSize: '14px', 
  boxSizing: 'border-box', 
  outline: 'none',
  transition: 'border-color 0.2s ease-in-out'
};

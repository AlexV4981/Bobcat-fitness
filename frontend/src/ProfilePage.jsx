import React, { useRef } from 'react';

// =================================================================================
// 1. DATA RECEIVING & IMAGE HANDLING:
// This profile and coding part gets all its data that is needed handed down from 
// App.jsx. It uses a special hidden file-input referee pointer to trigger a 
// image uploads in which you can put whatever picture you want. When the user selects
// an avatar picture, a temporary image URL is generated and immediately sent up to
// the App.jsx to be saved directly inside the account database record.
// =================================================================================
export default function ProfilePage({ 
  user, 
  isGuest, 
  profileImage, 
  weight, 
  height, 
  goal, 
  onProfileUpdate, 
  onLogout 
}) {
  const fileInputRef = useRef(null);
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && !isGuest) {
      const imageUrl = URL.createObjectURL(file);
      onProfileUpdate('profileImage', imageUrl);
    }
  };
  const getInitials = () => {
    if (!user || user.trim() === '') return 'BF';
    return user.substring(0, 2).toUpperCase();
  };

  return (
    // =================================================================================
    // 2. LAYOUT HEADER & ACCOUNT INFORMATION:
    // This section takes care of the overall background layout and includes the top header 
    // with the logout button. The first major card manages personal user data: 
    // clicking the circle avatar can make sure you can pick a profile picture
    // or leave it as is with the initials. You can also make sure to change your profile name
    // if you want to. The profile name is also your username in this case.
    // =================================================================================
    <div style={{ 
      flex: 1, 
      backgroundColor: '#F4F3EF', 
      padding: '40px', 
      fontFamily: 'sans-serif', 
      height: '100vh', 
      overflowY: 'auto' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <span style={{ color: '#666', fontSize: '14px' }}>Overview</span>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#121212', margin: '4px 0 0 0' }}>My Profile</h1>
          {isGuest && <p style={{ color: '#E67E22', fontSize: '12px', margin: '4px 0 0 0', fontWeight: '600' }}>⚠️ Guest Preview Mode (Read-Only)</p>}
        </div>
        <button onClick={onLogout} style={{ 
          backgroundColor: '#E74C3C', 
          color: '#FFF', 
          border: 'none', 
          padding: '8px 16px', 
          borderRadius: '8px', 
          cursor: 'pointer', 
          fontWeight: '600' 
        }}>
          Log Out
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '850px' }}>
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Account Information</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            
            <div 
              onClick={() => !isGuest && fileInputRef.current.click()} 
              style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '50%', 
                backgroundColor: '#D4F265', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 'bold', 
                fontSize: '24px', 
                cursor: isGuest ? 'default' : 'pointer', 
                overflow: 'hidden', 
                border: '2px solid #121212' 
              }}
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getInitials()
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#888' }}>PROFILE NAME</label>
              <input 
                type="text" 
                value={user} 
                disabled={isGuest}
                onChange={(e) => onProfileUpdate('username', e.target.value)} 
                style={{ 
                  border: 'none', 
                  borderBottom: '2px solid #121212', 
                  backgroundColor: 'transparent', 
                  fontSize: '18px', 
                  fontWeight: '700', 
                  color: '#121212',
                  outline: 'none', 
                  padding: '2px 0',
                  opacity: isGuest ? 0.6 : 1
                }}
              />
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              style={{ display: 'none' }} 
            />
          </div>
        </div>

   {/*} // =================================================================================
        // 3. FITNESS METRICS & SECURITY ENFORCEMENT:
        // This final part of the code acts as the interactive user dashboard of sorts. 
        // Here it has the implementation of adding your height, weight, or a goal which
        // you can change in the toggle box. It also saves the data if you want to log in. 
        // It also features a guest view of the profile. If someone wants to logs in via Guest access, 
        // the inputs change to an unclickable state to prevent modifications to the profile page.
        // ================================================================================= */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Fitness Metrics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={rowStyle}>
              <span>Height</span>
              <input 
                type="text" 
                value={height} 
                disabled={isGuest}
                onChange={e => onProfileUpdate('height', e.target.value)} 
                style={getInlineInputStyle(isGuest)} 
              />
            </div>
            <div style={rowStyle}>
              <span>Weight (lbs)</span>
              <input 
                type="text" 
                value={weight} 
                disabled={isGuest}
                onChange={e => onProfileUpdate('weight', e.target.value)} 
                style={getInlineInputStyle(isGuest)} 
              />
            </div>
            <div style={rowStyle}>
              <span>Current Goal</span>
              <select 
                value={goal} 
                disabled={isGuest}
                onChange={e => onProfileUpdate('goal', e.target.value)} 
                style={getInlineInputStyle(isGuest)}
              >
                <option>Build Endurance</option>
                <option>Strength Training</option>
                <option>Weight Loss</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Styling blueprints for overall card sizes and alignments
const cardStyle = { 
  backgroundColor: '#FFF', 
  padding: '24px', 
  borderRadius: '20px', 
  boxShadow: '0 4px 12px rgba(0,0,0,0.02)' 
};

const cardTitleStyle = { 
  fontSize: '13px', 
  fontWeight: '600', 
  color: '#121212', 
  marginBottom: '20px', 
  textTransform: 'uppercase', 
  letterSpacing: '0.5px' 
};

const rowStyle = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  paddingBottom: '10px', 
  borderBottom: '1px solid #F0F0F0', 
  color: '#444' 
};

const getInlineInputStyle = (isGuest) => ({
  border: 'none', 
  backgroundColor: '#EAE9E5', 
  padding: '6px 10px', 
  borderRadius: '6px', 
  width: '140px', 
  textAlign: 'right', 
  fontWeight: '600', 
  outline: 'none',
  color: '#121212',
  cursor: isGuest ? 'not-allowed' : 'text',
  opacity: isGuest ? 0.7 : 1
});

import React, { useRef, useState, useEffect } from 'react';
import { useDeviceMode } from './hooks/useDeviceMode';

export default function ProfilePage({
  user, email, pendingEmail, onLinkEmail,
  isGuest, profileImage, weight, height, goal,
  onSaveProfile, onUploadAvatar, onLogout
}) {
  const { isMobile } = useDeviceMode();
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState({ username: user, weight, height, goal });
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({ username: user, weight, height, goal });
  }, [user, weight, height, goal]);

  const setField = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  const dirty =
    draft.username !== user ||
    draft.weight !== weight ||
    draft.height !== height ||
    draft.goal !== goal;

  const handleSave = async () => {
    setSaveMsg('');
    setSaving(true);
    try {
      await onSaveProfile({
        username: draft.username.trim(),
        weight: draft.weight.trim(),
        height: draft.height.trim(),
        goal: draft.goal,
      });
      setSaveMsg('Saved!');
    } catch (err) {
      setSaveMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file || isGuest) return;
    setSaveMsg('');
    try {
      await onUploadAvatar(file);
    } catch (err) {
      setSaveMsg(err.message);
    }
  };

  const getInitials = () => {
    if (!user || user.trim() === '') return 'BF';
    return user.substring(0, 2).toUpperCase();
  };

  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const handleLinkEmail = async () => {
    setEmailMsg('');
    setEmailBusy(true);
    try {
      await onLinkEmail(newEmail.trim());
      setEmailMsg('Check your inbox for a confirmation link.');
      setNewEmail('');
    } catch (err) {
      setEmailMsg(err.message);
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <div
      data-device={isMobile ? 'mobile' : 'desktop'}
      style={{
        flex: 1,
        backgroundColor: '#F4F3EF',
        padding: isMobile ? '20px 16px 40px' : '40px',
        fontFamily: 'sans-serif',
        minHeight: '100dvh',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div>
          <span style={{ color: '#666', fontSize: '14px' }}>Overview</span>
          <h1 style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: '700', color: '#121212', margin: '4px 0 0 0' }}>
            My Profile
          </h1>
          {isGuest && (
            <p style={{ color: '#E67E22', fontSize: '12px', margin: '4px 0 0 0', fontWeight: '600' }}>
              ⚠️ Guest Preview Mode (Read-Only)
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          style={{
            backgroundColor: '#E74C3C',
            color: '#FFF',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Log Out
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? '16px' : '24px',
          maxWidth: '850px',
        }}
      >
        <div style={cardStyle(isMobile)}>
          <h3 style={cardTitleStyle}>Account Information</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div
              onClick={() => !isGuest && fileInputRef.current.click()}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: '#D4F265',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '22px',
                cursor: isGuest ? 'default' : 'pointer',
                overflow: 'hidden',
                border: '2px solid #121212',
                flexShrink: 0,
              }}
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getInitials()
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#888' }}>PROFILE NAME</label>
              <input
                type="text"
                value={draft.username}
                disabled={isGuest}
                onChange={(e) => setField('username', e.target.value)}
                style={{
                  border: 'none',
                  borderBottom: '2px solid #121212',
                  backgroundColor: 'transparent',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#121212',
                  outline: 'none',
                  padding: '2px 0',
                  width: '100%',
                  opacity: isGuest ? 0.6 : 1,
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

        <div style={cardStyle(isMobile)}>
          <h3 style={cardTitleStyle}>Fitness Metrics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={rowStyle}>
              <span>Height</span>
              <input
                type="text"
                value={draft.height}
                disabled={isGuest}
                onChange={(e) => setField('height', e.target.value)}
                style={getInlineInputStyle(isGuest, isMobile)}
              />
            </div>
            <div style={rowStyle}>
              <span>Weight (lbs)</span>
              <input
                type="text"
                value={draft.weight}
                disabled={isGuest}
                onChange={(e) => setField('weight', e.target.value)}
                style={getInlineInputStyle(isGuest, isMobile)}
              />
            </div>
            <div style={rowStyle}>
              <span>Current Goal</span>
              <select
                value={draft.goal}
                disabled={isGuest}
                onChange={(e) => setField('goal', e.target.value)}
                style={getInlineInputStyle(isGuest, isMobile)}
              >
                <option>Build Endurance</option>
                <option>Strength Training</option>
                <option>Weight Loss</option>
              </select>
            </div>
          </div>
        </div>

        <div style={cardStyle(isMobile)}>
          <h3 style={cardTitleStyle}>Email</h3>
          {email && <p style={{ color: '#444', marginTop: 0 }}>Linked: <strong>{email}</strong></p>}
          {pendingEmail && <p style={{ color: '#E67E22', fontSize: '13px' }}>Waiting for confirmation: {pendingEmail}</p>}
          <div style={rowStyle}>
            <input
              type="email"
              value={newEmail}
              disabled={isGuest}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={email ? 'Change email' : 'Link an email'}
              style={{ ...getInlineInputStyle(isGuest, isMobile), width: '100%', textAlign: 'left' }}
            />
          </div>
          <button
            type="button"
            onClick={handleLinkEmail}
            disabled={isGuest || emailBusy || !newEmail.trim()}
            style={{
              marginTop: '12px',
              backgroundColor: '#121212',
              color: '#FFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            {email ? 'Change email' : 'Link email'}
          </button>
          {emailMsg && <p style={{ fontSize: '13px', color: '#666' }}>{emailMsg}</p>}
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isGuest || saving || !dirty}
            style={{
              backgroundColor: '#121212',
              color: '#FFF',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              opacity: (isGuest || saving || !dirty) ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saveMsg && <span style={{ fontSize: '13px', color: '#666' }}>{saveMsg}</span>}
        </div>
      </div>
    </div>
  );
}

const cardStyle = (isMobile) => ({
  backgroundColor: '#FFF',
  padding: isMobile ? '18px' : '24px',
  borderRadius: '20px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
  minWidth: 0,
});

const cardTitleStyle = {
  fontSize: '13px',
  fontWeight: '600',
  color: '#121212',
  marginBottom: '16px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  paddingBottom: '10px',
  borderBottom: '1px solid #F0F0F0',
  color: '#444',
};

const getInlineInputStyle = (isGuest, isMobile) => ({
  border: 'none',
  backgroundColor: '#EAE9E5',
  padding: '6px 10px',
  borderRadius: '6px',
  width: isMobile ? '125px' : '140px',
  textAlign: 'right',
  fontWeight: '600',
  outline: 'none',
  color: '#121212',
  cursor: isGuest ? 'not-allowed' : 'text',
  opacity: isGuest ? 0.7 : 1,
});
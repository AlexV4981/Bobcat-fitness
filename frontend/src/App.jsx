import { useState } from 'react'
import './App.css'
import WebcamConnection from './components/WebcamConnection'

  /**
   * MANUAL COUNTER INTERGRATION:
   * This section should be able to records the count and the type of workout the user
   * chooses to do. It makees sure that it records the results which would then  
   * be saved once someone is done with the specific workout of choice.
   */
function App() {
  const [currentExercise, setCurrentExercise] = useState('Push-up')
  const [repCount, setRepCount] = useState(0)
  const [workoutHistory, setWorkoutHistory] = useState([])
  const incrementReps = () => setRepCount((prev) => prev + 1)
  const decrementReps = () => setRepCount((prev) => (prev > 0 ? prev - 1 : 0))
  const handleFinishWorkout = () => {
    if (repCount === 0) {
      alert("Do at least 1 rep before finishing!")
      return
    }
    const newRecord = {
      id: Date.now(),
      exercise: currentExercise,
      reps: repCount,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setWorkoutHistory((prevHistory) => [newRecord, ...prevHistory])
    setRepCount(0)
  }

 /**
   * STRUCTURE AND VISUAL LAYOUT:
   * So in this part of the coding, I made sure to set everything up as to put the 
   * webcam in a seperate card while the Rep Counter and the Exercise Results is put
   * on the other side. this also includes the 4 options we talked about in the 
   * meeting with the choice of Sit Ups, Squats, Pull Ups, and Push Ups.
   */
  return (
    <div style={dashboardBgStyle}>
      <div style={sessionWrapperStyle}>
        <header style={sessionHeaderStyle}>
          <div>
            <span style={liveBadgeStyle}>• Live Workout Space</span>
            <h2 style={sessionTitleStyle}>{currentExercise} Training</h2>
          </div>
        </header>
        <div style={sessionGridStyle}>
          <div style={videoWindowStyle}>
            <div style={videoBoxHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={liveIndicatorStyle}></span>
                <span>Camera Stream Monitoring View</span>
              </div>
            </div>
            <div style={videoComponentContainerStyle}>
              <WebcamConnection />
            </div>
          </div>
          <div style={trackerPanelStyle}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Select Target Movement</label>
              <select 
                value={currentExercise} 
                onChange={(e) => { setCurrentExercise(e.target.value); setRepCount(0); }}
                style={selectStyle}
              >
                <option value="Push-up">Push-ups 🧱</option>
                <option value="Pull-up">Pull-ups 🦾</option>
                <option value="Squat">Squats 🦵</option>
                <option value="Sit-up">Sit-ups 🧘</option> 
              </select>
            </div>

            <div style={counterBoxStyle}>
              <div style={counterLabelStyle}>Reps Completed</div>
              <div style={counterNumberStyle}>{repCount}</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button type="button" onClick={incrementReps} style={actionButtonStyle}>
                ＋ Count Rep
              </button>
              <button type="button" onClick={decrementReps} style={decrementButtonStyle}>
                － Undo
              </button>
            </div>
            <button type="button" onClick={handleFinishWorkout} style={finishButtonStyle}>
              Save Completed Set
            </button>
            <div style={historyContainerStyle}>
              <div style={historyHeaderRowStyle}>
                <span style={historyTitleStyle}>📜 Session History Results</span>
                <span style={{ fontSize: '11px', color: '#a3e635' }}>{workoutHistory.length} Sets</span>
              </div>
              {workoutHistory.length === 0 ? (
                <div style={emptyHistoryStyle}>
                  No historical entries recorded for this workout track.
                </div>
              ) : (
                <div style={historyScrollContainerStyle}>
                  {workoutHistory.map((log) => (
                    <div key={log.id} style={historyItemStyle}>
                      <div>
                        <span style={historyItemNameStyle}>{log.exercise}</span>
                        <span style={{ fontSize: '10px', color: '#666' }}>{log.timestamp}</span>
                      </div>
                      <span style={historyItemBadgeStyle}>
                        {log.reps} Reps
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * STYLE LAYOUTS:
 * 
 * So For this part of the code, I handled the styling in two places to keep things organized.
 * I made sure to make the style be similar to what we have in the homepage that was made for
 * the dashboard and the profile page. so this is mostly the styling part of the Rep Counter,
 * Webcam, and the Exersice Results.
 */

const dashboardBgStyle = {
  width: '100vw',
  minHeight: '100vh',
  backgroundColor: '#0b0f19',
  margin: 0,
  padding: 0,
  display: 'flex',
  justifyContent: 'center',
}

const sessionWrapperStyle = {
  width: '100%',
  maxWidth: '1280px',
  padding: '40px 24px',
  boxSizing: 'border-box',
}

const sessionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '32px',
  textAlign: 'left'
}

const liveBadgeStyle = {
  fontSize: '12px',
  color: '#a3e635',
  textTransform: 'uppercase',
  fontWeight: '600',
  letterSpacing: '1px'
}

const sessionTitleStyle = {
  margin: '4px 0 0 0',
  color: '#fff',
  fontSize: '24px',
  fontWeight: 'bold'
}

const sessionGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1.7fr 1fr',
  gap: '24px',
  alignItems: 'start',
}

const videoWindowStyle = {
  backgroundColor: '#111827',
  border: '1px solid #1f2937',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)'
}

const videoBoxHeaderStyle = {
  backgroundColor: '#1f2937',
  padding: '14px 20px',
  fontSize: '12px',
  color: '#9ca3af',
  textAlign: 'left',
  borderBottom: '1px solid #374151',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontWeight: '500'
}

const liveIndicatorStyle = {
  width: '8px',
  height: '8px',
  backgroundColor: '#ef4444',
  borderRadius: '50%',
  display: 'inline-block',
  boxShadow: '0 0 8px #ef4444'
}

const videoComponentContainerStyle = {
  padding: '24px',
  backgroundColor: '#030712',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '400px'
}

const trackerPanelStyle = {
  backgroundColor: '#111827',
  border: '1px solid #1f2937',
  borderRadius: '16px',
  padding: '24px',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)',
  textAlign: 'left',
}

const labelStyle = { 
  display: 'block', 
  fontSize: '11px', 
  color: '#6b7280', 
  marginBottom: '6px', 
  textTransform: 'uppercase', 
  fontWeight: '700',
  letterSpacing: '0.5px' 
}

const selectStyle = { 
  width: '100%', 
  padding: '10px 12px', 
  borderRadius: '8px', 
  backgroundColor: '#1f2937', 
  color: '#fff', 
  border: '1px solid #374151', 
  fontSize: '14px',
  fontWeight: '500',
  outline: 'none'
}

const counterBoxStyle = { 
  backgroundColor: '#030712', 
  border: '1px solid #1f2937', 
  borderRadius: '12px', 
  padding: '20px', 
  textAlign: 'center', 
  marginBottom: '16px' 
}

const counterLabelStyle = {
  fontSize: '11px',
  color: '#888',
  textTransform: 'uppercase',
  fontWeight: '600',
  letterSpacing: '0.5px'
}

const counterNumberStyle = {
  fontSize: '36px', 
  fontWeight: '800',
  color: '#fff',
  margin: '4px 0',
  fontFamily: 'monospace'
}

const actionButtonStyle = { 
  flex: 2, 
  padding: '12px', 
  backgroundColor: '#2563eb', 
  color: '#fff', 
  border: 'none', 
  borderRadius: '8px', 
  cursor: 'pointer', 
  fontWeight: '700', 
  fontSize: '14px',
}

const decrementButtonStyle = {
  flex: 1,
  padding: '12px',
  backgroundColor: '#1f2937',
  color: '#9ca3af',
  border: '1px solid #374151',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '14px',
}

const finishButtonStyle = { 
  width: '100%', 
  padding: '14px', 
  backgroundColor: '#a3e635', 
  color: '#0b0f19', 
  border: 'none', 
  borderRadius: '8px', 
  cursor: 'pointer', 
  fontWeight: '700', 
  fontSize: '14px', 
  textTransform: 'uppercase', 
  letterSpacing: '0.5px',
  marginBottom: '20px' 
}

const historyContainerStyle = { 
  borderTop: '1px solid #1f2937', 
  paddingTop: '16px' 
}

const historyHeaderRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px'
}

const historyTitleStyle = {
  fontSize: '11px',
  color: '#888',
  textTransform: 'uppercase',
  fontWeight: '600'
}

const emptyHistoryStyle = {
  fontSize: '12px',
  color: '#555',
  fontStyle: 'italic',
  padding: '12px 0',
  textAlign: 'center'
}

const historyScrollContainerStyle = { 
  maxHeight: '180px', 
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
}

const historyItemStyle = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  backgroundColor: '#1f2937', 
  padding: '10px 14px', 
  borderRadius: '8px', 
  fontSize: '13px',
}

const historyItemNameStyle = {
  color: '#fff',
  fontWeight: '500',
  marginRight: '6px'
}

const historyItemBadgeStyle = {
  fontWeight: '700',
  color: '#a3e635',
  backgroundColor: 'rgba(163, 230, 53, 0.1)',
  padding: '2px 8px',
  borderRadius: '4px'
}

export default App

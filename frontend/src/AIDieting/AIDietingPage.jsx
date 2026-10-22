import React, { useState } from 'react';

// This block initializes all reactive state trackers for the UI view. 
// It should set up the core chat message thread array, creates a structured 
// 7-day data dictionary used to plot the live calorie/protein bar graph, 
// and maintains the true/false completion flags for the daily health checklist.
export default function AIDietingPage({ userGoal = 'Build Endurance' }) {
  const [goal, setGoal] = useState('endurance');
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');

  const [messages, setMessages] = useState([
    { 
      sender: 'ai', 
      text: "Welcome to your Performance Nutrition Console. Tell me about your workouts, recent shifts, or current meals, and I will instantly analyze your strategy." 
    }
  ]);

  const [logs, setLogs] = useState([
    { day: 'Mon', calories: 2100, protein: 140 },
    { day: 'Tue', calories: 2300, protein: 155 },
    { day: 'Wed', calories: 1950, protein: 130 },
    { day: 'Thu', calories: 2200, protein: 145 },
    { day: 'Fri', calories: 2400, protein: 160 },
    { day: 'Sat', calories: 1800, protein: 110 },
    { day: 'Sun', calories: 2000, protein: 125 },
  ]);

  const [tasks, setTasks] = useState([
    { id: 1, text: "Consume 160g Targeted Protein", completed: true },
    { id: 2, text: "Hydrate post-workout (1 Gallon Water)", completed: false },
    { id: 3, text: "Bypass heavy saturated fats post-shift", completed: false }
  ]);

  const [newTaskInput, setNewTaskInput] = useState('');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [manualCal, setManualCal] = useState('2200');
  const [manualProt, setManualProt] = useState('145');
  const handleToggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTaskInput.trim(), completed: false }]);
    setNewTaskInput('');
  };

  const handleManualLogUpdate = (e) => {
    e.preventDefault();
    const updatedLogs = [...logs];
    updatedLogs[selectedDayIdx] = {
      ...updatedLogs[selectedDayIdx],
      calories: parseInt(manualCal) || 0,
      protein: parseInt(manualProt) || 0
    };
    setLogs(updatedLogs);
    alert(`Successfully synchronized data parameters for ${logs[selectedDayIdx].day}!`);
  };

  // This asynchronous function handles dispatching frontend text entries across 
  // the local network link to your Python FastAPI backend server. It forces an 
  // immediate UI state loading refresh, intercepts response errors gracefully 
  // to prevent code crashes, and scans the user's text for keywords like "water" 
  // to automatically toggle the checklist completion state to true.
  const sendQueryToBackend = async () => {
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setChatInput('');
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/ai-diet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fitness_goal: goal,
          workout_plan: userMessage
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to process target model layout.");
      setMessages(prev => [...prev, { sender: 'ai', text: data.ai_response }]);
      if (userMessage.toLowerCase().includes("water") || userMessage.toLowerCase().includes("hydrate")) {
        setTasks(prev => prev.map(t => t.id === 2 ? { ...t, completed: true } : t));
      }

    } catch (error) {
      console.error("FastAPI Backend Link Warning:", error);
      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: `⚠️ System Link Blocked: Unable to communicate with the Python network thread. Context: ${error.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // This section returns the layout for the AI Dieting Nutrition Console view.
  // It structures the screen into a main header and a responsive, two-column 
  // flex-grid dashboard. The columns should maps out a choice on whether you want to
  // manually change the options or let the AI input fields for you, all while 
  // it can update or check for you options on how to better your own
  // weekly bar charts.
  return (
    <div style={{ padding: '2.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'inherit', color: '#1a202c', display: 'flex', flexDirection: 'column', gap: '2rem', backgroundColor: 'transparent', minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: '700', letterSpacing: '-0.025em', color: '#1a202c' }}>🥗 AI Dieting Nutrition Console</h1>
        <p style={{ margin: '0.35rem 0 0 0', opacity: 0.8, fontSize: '1.05rem', color: '#2d3748' }}>Coordinate live machine learning optimization profiles with macro parameter charts instantly.</p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2.5rem', alignItems: 'start' }}>
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', height: '600px', overflow: 'hidden' }}> 
          <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.01)' }}>
            <span style={{ fontWeight: '600', fontSize: '1.1rem', color: '#1a202c' }}>💬 Consultation Stream</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '0.9rem', fontWeight: '500', background: '#fff', cursor: 'pointer', outline: 'none', color: '#1a202c' }}>
              <option value="endurance" style={{ color: '#1a202c' }}>Endurance & Maintenance 🧭</option>
              <option value="muscle-gain" style={{ color: '#1a202c' }}>Muscle Gain / Bulking 🏋️‍♂️</option>
              <option value="weight-loss" style={{ color: '#1a202c' }}>Weight Loss / Cutting 🏃‍♂️</option>
            </select>
          </div>
          <div style={{ flex: '1', padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'rgba(0,0,0,0.005)' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ 
                  maxWidth: '85%', 
                  padding: '1rem 1.25rem', 
                  borderRadius: msg.sender === 'user' ? '14px 14px 0 14px' : '14px 14px 14px 0', 
                  backgroundColor: msg.sender === 'user' ? '#3182ce' : '#f7fafc', 
                  color: msg.sender === 'user' ? '#fff' : '#1a202c',
                  border: msg.sender === 'user' ? 'none' : '1px solid rgba(0,0,0,0.05)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                  fontSize: '0.98rem',
                  lineHeight: '1.55',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '0.85rem 1.25rem', borderRadius: '0 12px 12px 12px', background: 'rgba(0,0,0,0.04)', opacity: 0.7, fontSize: '0.9rem', fontStyle: 'italic', color: '#2d3748' }}>
                  💬 Generating Responce...
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: '1.25rem', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: '0.75rem' }}>
            <input 
              type="text" 
              placeholder="Ask about recovery windows, macro distributions, or restaurant alternatives..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendQueryToBackend()}
              style={{ flex: '1', padding: '0.85rem 1.25rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '1rem', background: 'inherit', color: '#1a202c', outline: 'none' }}
            />
            <button 
              onClick={sendQueryToBackend}
              disabled={loading || !chatInput.trim()}
              style={{ padding: '0.85rem 1.5rem', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', opacity: (loading || !chatInput.trim()) ? 0.5 : 1 }}
            >
              Query
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '600px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.08)', padding: '1.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', flex: '1.2', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#1a202c' }}>📊 Full 7-Day Performance Metrics</h3>
              <p style={{ margin: '0 0 1.25rem 0', opacity: 0.7, fontSize: '0.85rem', color: '#2d3748' }}>Visual representation of weekly calibrated calories and protein data bounds.</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '170px', background: 'rgba(0,0,0,0.015)', padding: '1.5rem 1rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.03)' }}>
                {logs.map((log, idx) => {
                  const barHeight = Math.min((log.calories / 3500) * 130, 130); 
                  return (
                    <div key={idx} style={{ textAlign: 'center', flex: '1' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', opacity: 0.9, display: 'block', marginBottom: '4px', color: '#1a202c' }}>{log.protein}g</span>
                      <div style={{ height: `${barHeight}px`, background: 'linear-gradient(to top, #3182ce, #63b3ed)', borderRadius: '4px 4px 0 0', margin: '0 auto', width: '26px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}></div>
                      <strong style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '6px', color: '#1a202c' }}>{log.day}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                <button type="button" onClick={() => setActiveTab('chat')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'chat' ? '2px solid #3182ce' : 'none', fontWeight: '600', paddingBottom: '4px', cursor: 'pointer', fontSize: '0.9rem', color: '#1a202c', opacity: activeTab === 'chat' ? 1 : 0.5 }}>🤖 AI Log Prompting</button>
                <button type="button" onClick={() => setActiveTab('manual')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'manual' ? '2px solid #3182ce' : 'none', fontWeight: '600', paddingBottom: '4px', cursor: 'pointer', fontSize: '0.9rem', color: '#1a202c', opacity: activeTab === 'manual' ? 1 : 0.5 }}>⚙️ Manual Grid Overrides</button>
              </div>
              {activeTab === 'manual' ? (
                <form onSubmit={handleManualLogUpdate} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <select value={selectedDayIdx} onChange={(e) => setSelectedDayIdx(parseInt(e.target.value))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#1a202c' }}>
                    {logs.map((l, i) => <option key={i} value={i} style={{ color: '#1a202c' }}>{l.day}</option>)}
                  </select>
                  <input type="number" placeholder="Cals" value={manualCal} onChange={e => setManualCal(e.target.value)} style={{ padding: '0.5rem', width: '80px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', background: 'inherit', color: '#1a202c' }} />
                  <input type="number" placeholder="Protein(g)" value={manualProt} onChange={e => setManualProt(e.target.value)} style={{ padding: '0.5rem', width: '80px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', background: 'inherit', color: '#1a202c' }} />
                  <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#2d3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Update Day</button>
                </form>
              ) : (
                <div style={{ fontSize: '0.85rem', opacity: 0.7, fontStyle: 'italic', padding: '0.5rem 0', color: '#2d3748' }}>
                  💡 Tip: Tell the Gemini console chat tab "I ate 150g protein on Tuesday" to adjust bar bounds dynamically through parsing logic.
                </div>
              )}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.08)', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', flex: '0.9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', fontWeight: '600', color: '#1a202c' }}>📝 Daily Performance Parameters</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '140px', overflowY: 'auto' }}>
                {tasks.map(task => (
                  <label key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.92rem', cursor: 'pointer', textDecoration: task.completed ? 'line-through' : 'none', color: '#1a202c', opacity: task.completed ? 0.5 : 1 }}>
                    <input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task.id)} style={{ cursor: 'pointer' }} />
                    {task.text}
                  </label>
                ))}
              </div>
            </div>
            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.85rem', marginTop: '0.5rem' }}>
              <input type="text" placeholder="Add custom targeted metrics parameter..." value={newTaskInput} onChange={e => setNewTaskInput(e.target.value)} style={{ flex: '1', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.88rem', background: 'inherit', color: '#1a202c' }} />
              <button type="submit" style={{ padding: '0.45rem 1rem', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>Add</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


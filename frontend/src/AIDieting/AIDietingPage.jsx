import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { aiRequestHeaders } from '../lib/aiAuth.js';
import { SAMPLE_WORKOUT } from '../AIWorkout/lib/sample';
import { useDeviceMode } from '../hooks/useDeviceMode';

function summarizeWPO(wpo) {
  if (!wpo) return null;
  const days = Array.isArray(wpo) ? wpo : Array.isArray(wpo.days) ? wpo.days : wpo.plan_snapshot;
  if (Array.isArray(days)) {
    const dayLines = days.slice(0, 7).map((d) => {
      const exList = (d.exercises || []).map((e) => `${e.name} (${e.sets}x${e.reps})`).join(', ');
      return `${d.label || d.date || 'Day'}: ${exList}`;
    });
    return `Title: ${wpo.name || wpo.title || 'Scheduled Plan'} | Sessions: ${dayLines.join(' ; ')}`;
  }

  if (Array.isArray(wpo.blocks)) {
    const blockLines = wpo.blocks.map((b) => {
      const exList = (b.exercises || []).map((e) => `${e.name} ${e.sets}x${e.reps}`).join(', ');
      return `${b.name}: ${exList}`;
    });
    return `Title: ${wpo.title || 'Workout Plan'} | Duration: ${wpo.durationMin || 45}m | Intensity: ${wpo.intensity || 'Moderate'} | Blocks: ${blockLines.join(' ; ')}`;
  }
  return JSON.stringify(wpo).slice(0, 600);
}

export default function AIDietingPage({ userGoal = 'Build Endurance' }) {
  const { isMobile } = useDeviceMode();
  const [goal, setGoal] = useState('endurance');
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [isListening, setIsListening] = useState(false);
  const [importedWpo, setImportedWpo] = useState(null);
  const [wpoStatus, setWpoStatus] = useState('No Workout Plan Object imported yet.');
  const fileInputRef = useRef(null);
  const [dpoMeta, setDpoMeta] = useState({
    version: '1.0',
    goal: 'endurance',
    source_workout_title: 'Default Baseline',
    daily_calorie_target: 2100,
    daily_protein_target_g: 145,
  });

  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Welcome to your Performance Nutrition Console. Tell me about your workouts, recent shifts, or current meals, and I will instantly analyze your strategy."
    }
  ]);

  const [logs, setLogs] = useState([
    { day: 'Mon', calories: 2100, protein: 140, carbs: 230, fats: 65, meals: ['Oats & Whey', 'Chicken Rice Bowl', 'Salmon & Quinoa'] },
    { day: 'Tue', calories: 2300, protein: 155, carbs: 250, fats: 70, meals: ['Greek Yogurt Parfait', 'Turkey Wrap', 'Steak & Sweet Potato'] },
    { day: 'Wed', calories: 1950, protein: 130, carbs: 200, fats: 65, meals: ['Eggs & Toast', 'Tuna Salad', 'Grilled Chicken & Veggies'] },
    { day: 'Thu', calories: 2200, protein: 145, carbs: 240, fats: 68, meals: ['Protein Smoothie', 'Beef Burrito Bowl', 'Cod & Rice'] },
    { day: 'Fri', calories: 2400, protein: 160, carbs: 270, fats: 72, meals: ['Pancakes & Eggs', 'Chicken Pasta', 'Shrimp Stir-Fry'] },
    { day: 'Sat', calories: 1800, protein: 110, carbs: 190, fats: 60, meals: ['Omelet', 'Grilled Chicken Salad', 'Lean Burger'] },
    { day: 'Sun', calories: 2000, protein: 125, carbs: 220, fats: 65, meals: ['Overnight Oats', 'Chicken Quesadilla', 'Roast Turkey & Potatoes'] },
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

  const handleImportFromApp = async () => {
    try {
      const { data: run } = await supabase
        .from('workout_runs')
        .select('name, completion_pct, plan_snapshot')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (run?.plan_snapshot) {
        const wpoObj = { title: run.name, days: run.plan_snapshot };
        setImportedWpo(wpoObj);
        setWpoStatus(`Imported from Supabase: "${run.name}"`);
        return;
      }
      const savedLocal = localStorage.getItem('bobcat_active_workout') || localStorage.getItem('workout_history');
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        const latest = Array.isArray(parsed) ? parsed[0] : parsed;
        setImportedWpo(latest);
        setWpoStatus(`Imported from Saved Workouts: "${latest.title || 'Custom Workout'}"`);
        return;
      }
      setImportedWpo(SAMPLE_WORKOUT);
      setWpoStatus(`Loaded Sample WPO: "${SAMPLE_WORKOUT.title}"`);
    } catch (err) {
      console.error('WPO Import error:', err);
      setImportedWpo(SAMPLE_WORKOUT);
      setWpoStatus(`Loaded Sample WPO: "${SAMPLE_WORKOUT.title}"`);
    }
  };

  const handleUploadWpoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        setImportedWpo(parsed);
        setWpoStatus(`Uploaded WPO File: "${parsed.title || parsed.name || file.name}"`);
      } catch {
        alert('Invalid JSON file. Please upload a valid Workout Plan Object (.json).');
      }
    };
    reader.readAsText(file);
  };

  const buildStandardDPO = () => ({
    schema: 'bobcat-fitness-dpo-v1',
    exportedAt: new Date().toISOString(),
    goal,
    sourceWorkoutTitle: dpoMeta.source_workout_title,
    dailyTargets: {
      calories: dpoMeta.daily_calorie_target,
      protein_g: dpoMeta.daily_protein_target_g,
    },
    weeklySchedule: logs,
    actionChecklist: tasks.map((t) => ({ text: t.text, completed: t.completed })),
  });

  const handleExportDPO = () => {
    const standardDPO = buildStandardDPO();
    localStorage.setItem('bobcat_latest_dpo', JSON.stringify(standardDPO));
    const blob = new Blob([JSON.stringify(standardDPO, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diet-plan-${goal}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Your browser does not support Speech Recognition. Try Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setChatInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.start();
  };

  const sendQueryToBackend = async (overrideMessage = null) => {
    const userMessage = (overrideMessage ?? chatInput).trim();
    if (!userMessage) return;
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    if (!overrideMessage) setChatInput('');
    setLoading(true);
    try {
      const response = await fetch('/api/ai-diet', {
        method: "POST",
        headers: await aiRequestHeaders(),
        body: JSON.stringify({
          fitness_goal: goal,
          workout_plan: userMessage,
          wpo_summary: summarizeWPO(importedWpo),
          current_dpo: buildStandardDPO()
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to process target model layout.");
      setMessages(prev => [...prev, { sender: 'ai', text: data.ai_response }]);

      if (data.updated_dpo) {
        const dpo = data.updated_dpo;
        setDpoMeta({
          version: dpo.version || '1.0',
          goal: dpo.goal || goal,
          source_workout_title: dpo.source_workout_title || importedWpo?.title || 'Custom WPO',
          daily_calorie_target: dpo.daily_calorie_target || 2100,
          daily_protein_target_g: dpo.daily_protein_target_g || 150,
        });
        if (Array.isArray(dpo.weekly_schedule) && dpo.weekly_schedule.length > 0) {
          setLogs(dpo.weekly_schedule);
        }
        if (Array.isArray(dpo.action_checklist) && dpo.action_checklist.length > 0) {
          setTasks(
            dpo.action_checklist.map((text, index) => ({
              id: Date.now() + index,
              text,
              completed: false,
            }))
          );
        }
      }
      if (userMessage.toLowerCase().includes("water") || userMessage.toLowerCase().includes("hydrate")) {
        setTasks(prev => prev.map(t => t.id === 2 ? { ...t, completed: true } : t));
      }
    } catch (error) {
      console.error("Nutrition assistant request failed:", error);
      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: `⚠️ Nutrition assistant unavailable: ${error.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-device={isMobile ? 'mobile' : 'desktop'}
      style={{
        fontFamily: 'inherit',
        color: '#1a202c',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '1.25rem' : '2rem',
        backgroundColor: 'transparent',
        padding: isMobile ? '0.75rem' : '0',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          paddingBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <h1
            style={{
              margin: isMobile ? '0.25rem 0' : '1rem',
              fontSize: isMobile ? '1.65rem' : '2.25rem',
              fontWeight: '700',
              letterSpacing: '-0.025em',
              color: '#1a202c',
            }}
          >
            🥗 AI Dieting Nutrition Console
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', opacity: 0.8, fontSize: isMobile ? '0.95rem' : '1.05rem', color: '#2d3748' }}>
            Coordinate live machine learning optimization profiles with macro parameter charts instantly.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
          <button
            type="button"
            onClick={handleImportFromApp}
            style={{
              flex: isMobile ? '1 1 calc(50% - 0.25rem)' : '0 0 auto',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #3182ce',
              background: '#ebf8ff',
              color: '#2b6cb0',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            📥 Import Active WPO
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: isMobile ? '1 1 calc(50% - 0.25rem)' : '0 0 auto',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid rgba(0,0,0,0.15)',
              background: '#fff',
              color: '#1a202c',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            📂 Upload WPO (.json)
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleUploadWpoFile} style={{ display: 'none' }} />
          <button
            type="button"
            disabled={!importedWpo || loading}
            onClick={() => sendQueryToBackend('Build a complete 7-day diet plan based on my imported workout plan and fitness goal.')}
            style={{
              flex: isMobile ? '1 1 calc(50% - 0.25rem)' : '0 0 auto',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              border: 'none',
              background: importedWpo ? '#38a169' : '#cbd5e0',
              color: '#fff',
              fontWeight: '600',
              cursor: importedWpo ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem',
            }}
          >
            ⚡ Build Diet From WPO
          </button>
          <button
            type="button"
            onClick={handleExportDPO}
            style={{
              flex: isMobile ? '1 1 calc(50% - 0.25rem)' : '0 0 auto',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              border: 'none',
              background: '#2d3748',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            📤 Export DPO (.json)
          </button>
        </div>
      </header>

      <div
        style={{
          padding: '0.75rem 1.1rem',
          borderRadius: '10px',
          background: importedWpo ? '#f0fff4' : '#f7fafc',
          border: `1px solid ${importedWpo ? '#9ae6b4' : 'rgba(0,0,0,0.08)'}`,
          fontSize: '0.9rem',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '0.4rem',
        }}
      >
        <span><strong>Workout Context:</strong> {wpoStatus}</span>
        <span style={{ opacity: 0.75 }}>
          Target: <strong>{dpoMeta.daily_calorie_target} kcal</strong> / <strong>{dpoMeta.daily_protein_target_g}g protein</strong>
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: isMobile ? '1.25rem' : '2.5rem',
          alignItems: 'start',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '14px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            height: isMobile ? 'min(440px, 58dvh)' : '600px',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: isMobile ? '0.9rem 1rem' : '1.25rem',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              background: 'rgba(0,0,0,0.01)',
            }}
          >
            <span style={{ fontWeight: '600', fontSize: '1.05rem', color: '#1a202c' }}>💬 Consultation Stream</span>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.15)',
                fontSize: '0.88rem',
                fontWeight: '500',
                background: '#fff',
                cursor: 'pointer',
                outline: 'none',
                color: '#1a202c',
                maxWidth: '100%',
              }}
            >
              <option value="endurance">Endurance & Maintenance 🧭</option>
              <option value="muscle-gain">Muscle Gain / Bulking 🏋️‍♂️</option>
              <option value="weight-loss">Weight Loss / Cutting 🏃‍♂️</option>
            </select>
          </div>

          <div
            style={{
              flex: '1',
              padding: isMobile ? '1rem' : '1.5rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              background: 'rgba(0,0,0,0.005)',
            }}
          >
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '0.85rem 1.1rem',
                    borderRadius: msg.sender === 'user' ? '14px 14px 0 14px' : '14px 14px 14px 0',
                    backgroundColor: msg.sender === 'user' ? '#3182ce' : '#f7fafc',
                    color: msg.sender === 'user' ? '#fff' : '#1a202c',
                    border: msg.sender === 'user' ? 'none' : '1px solid rgba(0,0,0,0.05)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                    fontSize: '0.95rem',
                    lineHeight: '1.55',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '0.85rem 1.25rem', borderRadius: '0 12px 12px 12px', background: 'rgba(0,0,0,0.04)', opacity: 0.7, fontSize: '0.9rem', fontStyle: 'italic', color: '#2d3748' }}>
                  💬 Generating Response...
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: isMobile ? '0.85rem' : '1.25rem', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleVoiceInput}
              title="Voice input for making changes to dieting plan"
              style={{
                padding: '0.75rem 0.85rem',
                backgroundColor: isListening ? '#e53e3e' : '#edf2f7',
                color: isListening ? '#fff' : '#1a202c',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: '10px',
                fontWeight: '600',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {isListening ? '🛑' : '🎤'}
            </button>
            <input
              type="text"
              placeholder={isListening ? 'Listening...' : 'Ask about macros, meals, or recovery...'}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendQueryToBackend()}
              style={{ flex: '1', minWidth: 0, padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.95rem', background: 'inherit', color: '#1a202c', outline: 'none' }}
            />
            <button
              type="button"
              onClick={() => sendQueryToBackend()}
              disabled={loading || !chatInput.trim()}
              style={{ padding: isMobile ? '0.75rem 1rem' : '0.85rem 1.5rem', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '0.92rem', cursor: 'pointer', opacity: (loading || !chatInput.trim()) ? 0.5 : 1, flexShrink: 0 }}
            >
              Query
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1.25rem' : '2rem', minHeight: isMobile ? 'auto' : '600px', minWidth: 0 }}>
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.08)', padding: isMobile ? '1.1rem' : '1.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', fontWeight: '600', color: '#1a202c' }}>📊 Full 7-Day Performance Metrics</h3>
              <p style={{ margin: '0 0 1rem 0', opacity: 0.7, fontSize: '0.85rem', color: '#2d3748' }}>Visual representation of weekly calibrated calories and protein data bounds.</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: isMobile ? '145px' : '170px', background: 'rgba(0,0,0,0.015)', padding: isMobile ? '1rem 0.4rem' : '1.5rem 1rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.03)', gap: '2px' }}>
                {logs.map((log, idx) => {
                  const barHeight = Math.min((log.calories / 3500) * (isMobile ? 105 : 130), isMobile ? 105 : 130);
                  return (
                    <div key={idx} title={log.meals?.join(' • ') || ''} style={{ textAlign: 'center', flex: '1', minWidth: 0 }}>
                      <span style={{ fontSize: isMobile ? '9px' : '10px', fontWeight: '700', opacity: 0.9, display: 'block', marginBottom: '4px', color: '#1a202c' }}>{log.protein}g</span>
                      <div style={{ height: `${barHeight}px`, background: 'linear-gradient(to top, #3182ce, #63b3ed)', borderRadius: '4px 4px 0 0', margin: '0 auto', width: isMobile ? '16px' : '26px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}></div>
                      <strong style={{ fontSize: isMobile ? '10px' : '11px', opacity: 0.8, display: 'block', marginTop: '6px', color: '#1a202c' }}>{log.day}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setActiveTab('chat')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'chat' ? '2px solid #3182ce' : 'none', fontWeight: '600', paddingBottom: '4px', cursor: 'pointer', fontSize: '0.9rem', color: '#1a202c', opacity: activeTab === 'chat' ? 1 : 0.5 }}>🤖 AI Log Prompting</button>
                <button type="button" onClick={() => setActiveTab('manual')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'manual' ? '2px solid #3182ce' : 'none', fontWeight: '600', paddingBottom: '4px', cursor: 'pointer', fontSize: '0.9rem', color: '#1a202c', opacity: activeTab === 'manual' ? 1 : 0.5 }}>⚙️ Manual Grid Overrides</button>
              </div>
              {activeTab === 'manual' ? (
                <form onSubmit={handleManualLogUpdate} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <select value={selectedDayIdx} onChange={(e) => setSelectedDayIdx(parseInt(e.target.value))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#1a202c' }}>
                    {logs.map((l, i) => <option key={i} value={i}>{l.day}</option>)}
                  </select>
                  <input type="number" placeholder="Cals" value={manualCal} onChange={e => setManualCal(e.target.value)} style={{ padding: '0.5rem', width: '80px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', background: 'inherit', color: '#1a202c' }} />
                  <input type="number" placeholder="Protein(g)" value={manualProt} onChange={e => setManualProt(e.target.value)} style={{ padding: '0.5rem', width: '86px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', background: 'inherit', color: '#1a202c' }} />
                  <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#2d3748', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Update Day</button>
                </form>
              ) : (
                <div style={{ fontSize: '0.85rem', opacity: 0.7, fontStyle: 'italic', padding: '0.5rem 0', color: '#2d3748' }}>
                  💡 Tip: Tell the consultation chat "I ate 150g protein on Tuesday" to adjust bar bounds dynamically.
                </div>
              )}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.08)', padding: isMobile ? '1.1rem' : '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', fontWeight: '600', color: '#1a202c' }}>📝 Daily Performance Parameters</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '160px', overflowY: 'auto' }}>
                {tasks.map(task => (
                  <label key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.92rem', cursor: 'pointer', textDecoration: task.completed ? 'line-through' : 'none', color: '#1a202c', opacity: task.completed ? 0.5 : 1 }}>
                    <input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task.id)} style={{ cursor: 'pointer' }} />
                    <span>{task.text}</span>
                  </label>
                ))}
              </div>
            </div>
            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.85rem', marginTop: '0.75rem' }}>
              <input type="text" placeholder="Add custom parameter..." value={newTaskInput} onChange={e => setNewTaskInput(e.target.value)} style={{ flex: '1', minWidth: 0, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.88rem', background: 'inherit', color: '#1a202c' }} />
              <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', flexShrink: 0 }}>Add</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import './AboutUsPage.css';

export default function AboutUs() {
  const teamMembers = [
    {
      id: 1,
      name: "Hung Nguyen",
      role: "Senior Year CS Major • Business Admin Minor",
      goal: "Want to be a Software Engineer or adjacent industry.",
      bio: "I like the idea of improving our everyday lives with AI.",
      link: "https://www.linkedin.com/in/hungvnguyen922/",
      position: "up"
    },
    {
      id: 2,
      name: "Robert Zamora",
      role: "Senior Year CS Major • Math Minor",
      goal: "Want to be in a Management position with plans to pursue an MBA.",
      bio: "I wanted to learn something new and see what ideas others had.",
      link: null,
      position: "down"
    },
    {
      id: 3,
      name: "Daniel Saieh",
      role: "Senior Year CS Major",
      goal: "Want to be a Software Engineer.",
      bio: "Hungry for Programming knowledge.",
      link: null,
      position: "up"
    },
    {
      id: 4,
      name: "TBD",
      role: "Team Member Slot",
      goal: "Open Role",
      bio: "Information coming soon.",
      link: null,
      position: "down",
      isBlank: true
    },
    {
      id: 5,
      name: "TBD",
      role: "Team Member Slot",
      goal: "Open Role",
      bio: "Information coming soon.",
      link: null,
      position: "down",
      isBlank: true
    }
  ];

  return (
    <div className="about-container">
      {/* Header & Company Goal Section */}
      <header className="about-header">
        <span className="section-label">Our Mission</span>
        <h1 className="about-title">Company Goal</h1>
        <div className="vision-card">
          <p className="vision-text">
            Our main goal is to create an intuitive application that helps users find exercises tailored to their body goals while reinforcing proper form. Incorrect form not only reduces exercise effectiveness but also significantly increases injury risks—often forcing months of recovery and deterring positive lifestyle habits.
          </p>
          <p className="vision-text" style={{ marginTop: '12px' }}>
            By organizing workouts by muscle groups, providing interactive diagrams, form tips, and animated visuals, we guide users toward safe, effective routines. In the future, we plan to integrate Computer Vision for real-time personalized feedback, creating an environment where users can focus entirely on achieving their goals safely.
          </p>
        </div>
      </header>

      {/* Zig-Zag Team Section */}
      <section className="team-section">
        <span className="section-label">Who We Are</span>
        <h2 className="team-title">The People Behind The Project</h2>
        
        <div className="zigzag-grid">
          {teamMembers.map((member) => (
            <div 
              key={member.id} 
              className={`member-cube cube-${member.position} ${member.isBlank ? 'cube-blank' : ''}`}
            >
              <div className="cube-badge">#{member.id}</div>
              <h3 className="member-name">{member.name}</h3>
              <p className="member-role">{member.role}</p>
              
              {!member.isBlank ? (
                <>
                  <div className="member-detail">
                    <span className="detail-label">Goal</span>
                    <p className="detail-val">{member.goal}</p>
                  </div>
                  <div className="member-detail">
                    <span className="detail-label">Motivation</span>
                    <p className="detail-val">{member.bio}</p>
                  </div>
                  {member.link && (
                    <span className="linkedin-tag">
                      LinkedIn Connected
                    </span>
                  )}
                </>
              ) : (
                <div className="blank-placeholder">
                  <span>Slot Reserved</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
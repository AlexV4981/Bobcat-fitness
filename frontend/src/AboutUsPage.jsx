import React from 'react';
import './AboutUsPage.css';

export default function AboutUs() {
  const teamMembers = [
    {
      id: 1,
      name: "Hung Nguyen",
      role: "Senior Year CS Major • Business Admin Minor",
      goal: "Want to be a Software Engineer or adjacent industry.",
      bio: "Like the idea of improving our everyday lives with AI.",
      link: "https://www.linkedin.com/in/hungvnguyen922/",
      position: "up"
    },
    {
      id: 2,
      name: "Robert Zamora",
      role: "Senior Year CS Major • Math Minor",
      goal: "Want to be in a Management position with plans to pursue an MBA.",
      bio: "Wanting to learn something new and see what ideas others had.",
      link: null,
      position: "down"
    },
    {
      id: 3,
      name: "Daniel Saieh",
      role: "Senior Year CS Major • Data Analytics Minor",
      goal: "Pursuing Software Engineer role and creating some insane stuff in the future.",
      bio: "A person whos hungry for Programming knowledge.",
      link: null,
      position: "up"
    },
    {
      id: 4,
      name: "Alex Vargas",
      role: "Senior Year CS Major",
      goal: "Looking for opportunities in Software and Cybersecurity",
      bio: "Wanting to bridge the gap between software and cybersecurity",
      link: "https://www.linkedin.com/in/alex-vargas-aaa22027b/?isSelfProfile=true",
      position: "down",
    },
    {
      id: 5,
      name: "Ryan McCloskey",
      role: "Senior year CS Major • Math Minor",
      goal: "Exploring different career options in the industry.",
      bio: "Vastly expanding my knowledge and skills",
      link: null,
      position: "up",
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
        <h1 className="about-title">The People Behind The Project</h1>
        
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
                    <span className="detail-label">Bio</span>
                    <p className="detail-val">{member.bio}</p>
                  </div>
                  {member.link && (
                    <a 
                      href={member.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="linkedin-link"
                    >
                      LinkedIn Profile →
                    </a>
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
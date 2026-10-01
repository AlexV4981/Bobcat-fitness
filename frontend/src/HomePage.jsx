import "./HomePage.css";
import { AtAGlance, BestThisWeek, DailyNutrition, FormReview, MySpotlight, PageHeader, Sidebar, TrainingLoad, WorkoutHero } from "./components";

/**
 * Bobcat Fitness — Home page
 *
 * Composes the dashboard out of the widgets in ./components. Each widget
 * owns its own mock data for now — see the "TODO(api)" comment at the top
 * of each file for where to wire in the real FastAPI endpoint.
 */
export default function HomePage({ userName = "there", onNavigate, onLogout  }) {
  return (
    <div className="home">
      <Sidebar onNavigate={onNavigate} onLogout={onLogout} />

      <main className="content">
        <PageHeader userName={userName} />

        <div className="grid">
          <div className="col-main">
            <WorkoutHero />
            <DailyNutrition />
            <AtAGlance />
          </div>

          <div className="col-side">
            <BestThisWeek />
            <MySpotlight />
            <FormReview />
            <TrainingLoad />
          </div>
        </div>
      </main>
    </div>
  );
}

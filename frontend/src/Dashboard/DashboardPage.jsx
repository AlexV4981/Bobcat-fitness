import tempImage from '../assets/tempbutton.png'
import tempGraphImage from '../assets/tempGraph.png'
import Widget from '../components/components'
import './Dashboard.css'
function handleClick(){
  //Will do something later
}


//Only 3 main sections for now later work will add more sections depending on what is decided
function Dashboard() {
  return (
    <main className="dashboard">

      <section className="dashboard-left-section">
          <button type="button" onClick={handleClick}>
            Home
            <img src={tempImage} alt=""></img>
          </button>

          <button type="button" onClick={handleClick}>
            Dashboard
            <img src={tempImage} alt=""></img>
          </button>

          <button type="button" onClick={handleClick}>
            Placeholder
            <img src={tempImage} alt=""></img>
          </button>

          <Widget title="Left Side Buttons">
            <span>Home</span>
            <span>Dashboard</span>
            <span>Placeholder</span>
          </Widget>

        {}

      </section>

      <section className="dashboard-center-section">
        <Widget title="In depth graph and proress charts">
          <img src={tempGraphImage} alt =""/>
        </Widget>

        {}

      </section>

{/* 
      <section className="dashboard-right-section">
        Not sure if we wil need this but ill keep it just incase future delopment requires this extra section
        {}
      </section> */}








    </main>
  )
}

export default Dashboard

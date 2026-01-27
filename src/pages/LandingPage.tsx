import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

const LandingPage = () => {
  const navigate = useNavigate()

  const handleCreateCharacter = () => {
    navigate('/character-creation')
  }

  return (
    <div className="landing-page">
      <div className="landing-container">
        <h1 className="landing-title">D&D AI Dungeon Master</h1>
        
        <div className="description-section">
          <h2>Welcome to Your Adventure</h2>
          <p>
            This is your gateway to an immersive Dungeons & Dragons experience powered by AI. 
            Our AI Dungeon Master will guide you through epic adventures, manage game mechanics, 
            and bring your stories to life.
          </p>
          <p>
            Create your character, build your campaign, and embark on quests where every choice 
            matters. The AI DM will handle dice rolls, skill checks, combat mechanics, and 
            narrative storytelling, allowing you to focus on roleplaying and decision-making.
          </p>
          <p>
            Whether you're a seasoned adventurer or new to D&D, this platform provides everything 
            you need for an engaging tabletop RPG experience.
          </p>
        </div>

        <div className="cta-section">
          <button className="create-character-btn" onClick={handleCreateCharacter}>
            Create a Character
          </button>
        </div>
      </div>
    </div>
  )
}

export default LandingPage


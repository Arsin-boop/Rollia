import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CharacterCreation from './pages/CharacterCreation'
import CampaignHub from './pages/CampaignHub'
import GameSession from './pages/GameSession'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/character-creation" element={<CharacterCreation />} />
        <Route path="/campaign-hub" element={<CampaignHub />} />
        <Route path="/game/:campaignId" element={<GameSession />} />
      </Routes>
    </Router>
  )
}

export default App


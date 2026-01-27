import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Play } from 'lucide-react'
import './CampaignHub.css'

type Campaign = {
  id: string
  name: string
  createdAt: string
}

const CampaignHub = () => {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleCreateCampaign = () => {
    if (newCampaignName.trim()) {
      const newCampaign: Campaign = {
        id: Date.now().toString(),
        name: newCampaignName.trim(),
        createdAt: new Date().toISOString()
      }
      setCampaigns([...campaigns, newCampaign])
      setNewCampaignName('')
      setIsCreating(false)
    }
  }

  const handleStartEdit = (campaign: Campaign) => {
    setEditingId(campaign.id)
    setEditName(campaign.name)
  }

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      setCampaigns(campaigns.map(c => 
        c.id === id ? { ...c, name: editName.trim() } : c
      ))
      setEditingId(null)
      setEditName('')
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleSelectCampaign = (campaignId: string) => {
    navigate(`/game/${campaignId}`)
  }

  return (
    <div className="campaign-hub">
      <div className="hub-container">
        <h1 className="hub-title">Campaign Hub</h1>
        <p className="hub-subtitle">Create or select a campaign to begin your adventure</p>

        <div className="campaigns-section">
          {campaigns.length === 0 && !isCreating && (
            <div className="empty-state">
              <p>No campaigns yet. Create your first campaign to start playing!</p>
            </div>
          )}

          {isCreating && (
            <div className="campaign-card creating">
              <input
                type="text"
                placeholder="Enter campaign name"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                className="campaign-name-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateCampaign()
                  } else if (e.key === 'Escape') {
                    setIsCreating(false)
                    setNewCampaignName('')
                  }
                }}
              />
              <div className="campaign-actions">
                <button
                  className="action-btn save-btn"
                  onClick={handleCreateCampaign}
                  disabled={!newCampaignName.trim()}
                >
                  Create
                </button>
                <button
                  className="action-btn cancel-btn"
                  onClick={() => {
                    setIsCreating(false)
                    setNewCampaignName('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {campaigns.map((campaign) => (
            <div key={campaign.id} className="campaign-card">
              {editingId === campaign.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="campaign-name-input"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit(campaign.id)
                      } else if (e.key === 'Escape') {
                        handleCancelEdit()
                      }
                    }}
                  />
                  <div className="campaign-actions">
                    <button
                      className="action-btn save-btn"
                      onClick={() => handleSaveEdit(campaign.id)}
                      disabled={!editName.trim()}
                    >
                      Save
                    </button>
                    <button
                      className="action-btn cancel-btn"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="campaign-info">
                    <h2 className="campaign-name">{campaign.name}</h2>
                    <p className="campaign-date">
                      Created: {new Date(campaign.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="campaign-actions">
                    <button
                      className="action-btn edit-btn"
                      onClick={() => handleStartEdit(campaign)}
                      title="Rename campaign"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      className="action-btn play-btn"
                      onClick={() => handleSelectCampaign(campaign.id)}
                      title="Start campaign"
                    >
                      <Play size={18} />
                      <span>Play</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {!isCreating && (
          <button
            className="create-campaign-btn"
            onClick={() => setIsCreating(true)}
          >
            <Plus size={24} />
            Create New Campaign
          </button>
        )}
      </div>
    </div>
  )
}

export default CampaignHub


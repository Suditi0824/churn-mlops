import { useState } from 'react'
import Overview from './pages/Overview'
import Predict from './pages/Predict'
import Models from './pages/Models'
import './index.css'

const NAV = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'predict',  label: 'Predict',  icon: '⟳' },
  { id: 'models',   label: 'Models',   icon: '◈' },
]

export default function App() {
  const [page, setPage] = useState('overview')

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-logo">
          ChurnGuard
          <span>ML Feature Store · v1.0</span>
        </div>
        {NAV.map(n => (
          <div
            key={n.id}
            className={`nav-item ${page === n.id ? 'active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span>{n.icon}</span> {n.label}
          </div>
        ))}
      </div>
      <div className="main">
        {page === 'overview' && <Overview />}
        {page === 'predict'  && <Predict />}
        {page === 'models'   && <Models />}
      </div>
    </div>
  )
}
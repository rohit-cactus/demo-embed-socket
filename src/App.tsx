import { Routes, Route, NavLink } from 'react-router-dom'
import DefaultViewer from './pages/DefaultViewer'
import './styles/App.css'
import { CustomViewerTwo } from './pages/CustomViewerTwo'
import { ComparisonViewer } from './pages/ComparisonViewer'
import PeerReviewViewer from './pages/peer-review'

function App() {
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <h1>EmbedPDF Viewer</h1>
        </div>
        <div className="nav-links">
          <NavLink
            to="/"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Default Viewer
          </NavLink>
          <NavLink
            to="/custom"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Custom Viewer
          </NavLink>
          <NavLink
            to="/peer-review"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Peer Review
          </NavLink>
          <NavLink
            to="/comparison"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Comparison View
          </NavLink>
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<DefaultViewer />} />
          <Route path="/custom" element={<CustomViewerTwo />} />
          <Route path="/custom-two" element={<CustomViewerTwo />} />
          <Route path="/peer-review" element={<PeerReviewViewer />} />
          <Route path="/comparison" element={<ComparisonViewer />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

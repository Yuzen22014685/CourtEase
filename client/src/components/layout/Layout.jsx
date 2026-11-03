import { Link, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import { useAuth } from '../../context/AuthContext'
import ChatWidget from '../chat/ChatWidget'
import PlayerTabBar from './PlayerTabBar'

export default function Layout({ children }) {
  const { isPlayer } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-16 sm:pb-0">
      <Navbar />
      <main className="flex-1 animate-fadeIn">
        {children}
      </main>
      {isPlayer && <ChatWidget />}
      <footer className="mt-auto py-4 pb-20 sm:pb-4 px-4 text-center text-xs text-gray-400 border-t border-gray-200 bg-gray-50">
        © 2026 CourtEase
        {' · '}
        <Link to="/help" className="hover:text-gray-600">Help &amp; Contact</Link>
        {' · '}
        <Link to="/privacy" state={{ from: location.pathname }} className="hover:text-gray-600">Privacy Notice</Link>
        {' · '}
        <Link to="/terms" state={{ from: location.pathname }} className="hover:text-gray-600">Terms of Use</Link>
      </footer>
      <PlayerTabBar />
    </div>
  )
}

import Navbar from './Navbar'
import { useAuth } from '../../context/AuthContext'
import ChatWidget from '../chat/ChatWidget'

export default function Layout({ children }) {
  const { isPlayer } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 animate-fadeIn">
        {children}
      </main>
      {isPlayer && <ChatWidget />}
    </div>
  )
}

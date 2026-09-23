import { useState, useEffect } from 'react'
import Navbar from './Navbar'
import AdminSidebar from './AdminSidebar'
import { getPendingCount } from '../../api/admin'

export default function AdminLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await getPendingCount()
        setPendingCount(res.data?.count ?? 0)
      } catch {
        // silently ignore — badge won't show if request fails
      }
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30_000)

    const handleCountChanged = () => fetchCount()
    window.addEventListener('pending-count-changed', handleCountChanged)

    return () => {
      clearInterval(interval)
      window.removeEventListener('pending-count-changed', handleCountChanged)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar onMenuClick={() => setIsSidebarOpen(true)} pendingCount={pendingCount} />
      <div className="flex flex-1 min-w-0">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          pendingCount={pendingCount}
        />
        <main className="flex-1 min-w-0 animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  )
}

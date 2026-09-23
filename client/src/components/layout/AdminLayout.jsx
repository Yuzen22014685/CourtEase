import Navbar from './Navbar'
import AdminSidebar from './AdminSidebar'

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 min-w-0 animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  )
}

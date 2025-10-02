'use client'

import { useSession } from '@/components/providers/SessionProvider'

export default function DashboardPage() {
  const { user } = useSession()

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to Landlord Portal
        </h2>
        <p className="text-gray-600 mb-4">
          Logged in as: <span className="font-medium">{user?.email}</span>
        </p>
        <div className="mt-6 border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h4 className="font-medium text-gray-900">Properties</h4>
              <p className="text-sm text-gray-600 mt-1">Manage your properties</p>
            </div>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h4 className="font-medium text-gray-900">Tenants</h4>
              <p className="text-sm text-gray-600 mt-1">View and manage tenants</p>
            </div>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h4 className="font-medium text-gray-900">Reports</h4>
              <p className="text-sm text-gray-600 mt-1">Generate reports</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

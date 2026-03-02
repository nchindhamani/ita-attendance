import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Role } from '@/lib/types'

const supabase = createSupabaseBrowserClient()

type User = {
  id: string
  full_name: string | null
  email: string
  role: Role
  grade: string | null
  section: string | null
  description: string | null
  is_active: boolean
  is_approved: boolean
}

export default function PrincipalUsersPage() {
  useRequireRole('principal')
  const navigate = useNavigate()
  
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all profiles (read-only via RLS)
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        setUsers((data || []) as User[])
        setFilteredUsers((data || []) as User[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users')
        console.error('Error fetching users:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = users.filter(
      (user) =>
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          User Profiles
        </h2>
        <p className="text-base text-muted-foreground">
          View all user profiles (read-only).
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
      </div>

      {/* User Cards Grid */}
      {filteredUsers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg flex-shrink-0">
                    {getInitials(user.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">{user.full_name || 'Unknown'}</h3>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 capitalize">
                        {user.role === 'volunteer' && user.description
                          ? `Volunteer - ${user.description}`
                          : user.role.replace('_', ' ')}
                      </span>
                      {user.grade && user.section && (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                          {user.grade}/{user.section}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              {searchQuery ? 'No users found matching your search.' : 'No users found.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}




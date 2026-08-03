// User presence indicators for collaboration
import type { User } from '../hooks/useCollaboration'

interface UserPresenceProps {
  users: User[]
  currentUserId: string
}

export function UserPresence({ users, currentUserId }: UserPresenceProps) {
  const otherUsers = users.filter(u => u.id !== currentUserId)

  if (otherUsers.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
        <span className="h-2 w-2 rounded-full bg-gray-400"></span>
        <span>Only you viewing</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
        {otherUsers.length + 1} viewing:
      </span>
      <div className="flex -space-x-2">
        {/* Current user */}
        <div
          className="relative h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 bg-blue-500 flex items-center justify-center text-xs font-bold text-white"
          title="You"
        >
          Y
        </div>
        {/* Other users */}
        {otherUsers.slice(0, 5).map((user) => (
          <div
            key={user.id}
            className="relative h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name[0]?.toUpperCase() || '?'}
          </div>
        ))}
        {otherUsers.length > 5 && (
          <div className="relative h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-500 flex items-center justify-center text-xs font-bold text-white">
            +{otherUsers.length - 5}
          </div>
        )}
      </div>
    </div>
  )
}

// Toast notification component for user feedback
import { useEffect } from 'react'
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  onClose: () => void
}

const toastColors = {
  success: {
    bg: '#ecfdf5',
    border: '#d1fae5',
    text: '#065f46',
    icon: '#10b981',
  },
  error: {
    bg: '#fef2f2',
    border: '#fee2e2',
    text: '#7f1d1d',
    icon: '#ef4444',
  },
  warning: {
    bg: '#fffbeb',
    border: '#fef3c7',
    text: '#92400e',
    icon: '#f59e0b',
  },
  info: {
    bg: '#f0f9ff',
    border: '#bfdbfe',
    text: '#1e40af',
    icon: '#3b82f6',
  },
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
}

export function Toast({ message, type, duration = 4000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const colors = toastColors[type]
  const Icon = toastIcons[type]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '8px',
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 50,
        animation: 'slideIn 0.3s ease-out',
        maxWidth: '400px',
      }}
    >
      <Icon size={18} color={colors.icon} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: colors.text,
          cursor: 'pointer',
          padding: '0 4px',
          display: 'flex',
          alignItems: 'center',
          opacity: 0.7,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.7'
        }}
      >
        <X size={16} />
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

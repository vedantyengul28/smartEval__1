export function Loader({ size = 'md', text = null, ...props }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-[3px]',
    lg: 'w-10 h-10 border-4',
  }
  return (
    <div className="flex items-center justify-center gap-3" {...props}>
      <div className={`${sizes[size]} border-slate-200 border-t-brand-600 rounded-full animate-spin`} role="status" />
      {text && <span className="text-slate-600 text-sm">{text}</span>}
    </div>
  )
}

export function EmptyState({ icon = '📭', title = 'No data', subtitle = null, action = null }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 max-w-md mb-6">{subtitle}</p>}
      {action}
    </div>
  )
}

export function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    primary: 'bg-brand-50 text-brand-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-sky-50 text-sky-700',
  }
  return <span className={`badge ${variants[variant] || variants.default}`}>{children}</span>
}

export function StatusBadge({ status }) {
  const map = {
    draft: ['info', 'Draft'],
    published: ['success', 'Published'],
    closed: ['default', 'Closed'],
    pending: ['warning', 'Pending'],
    evaluating: ['info', 'Evaluating'],
    evaluated: ['primary', 'Evaluated'],
    reviewed: ['primary', 'Reviewed'],
    approved: ['success', 'Approved'],
    completed: ['success', 'Completed'],
    failed: ['danger', 'Failed'],
    accepted: ['success', 'All Passed'],
    wrong_answer: ['danger', 'Wrong Answer'],
    compilation_error: ['danger', 'Compile Error'],
    runtime_error: ['danger', 'Runtime Error'],
  }
  const [variant, label] = map[status] || ['default', status]
  return <Badge variant={variant}>{label}</Badge>
}

export function Modal({ open, onClose, title, children, actions = null, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white w-full ${sizes[size]} rounded-xl shadow-2xl max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
        {actions && <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">{actions}</div>}
      </div>
    </div>
  )
}

export function formatDate(date) {
  if (!date) return '—'
  try {
    const d = new Date(date)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

export function MarkDisplay({ awarded, max, showGrade = true }) {
  const pct = max > 0 ? awarded / max : 0
  const color = pct >= 0.75 ? 'text-emerald-600' : pct >= 0.5 ? 'text-amber-600' : 'text-red-600'
  return (
    <span className={`font-semibold ${color}`}>
      {typeof awarded === 'number' ? awarded.toFixed(1) : awarded}
      <span className="text-slate-500 font-normal"> / {max}</span>
    </span>
  )
}

/** Loading / error / empty states. */
export function StatusMessage({ tone = 'info', title, detail, onRetry }) {
  return (
    <div className={`status status--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

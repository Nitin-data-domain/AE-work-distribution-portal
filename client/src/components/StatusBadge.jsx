export default function StatusBadge({ status, source }) {
  const map = {
    'Submitted':   'badge badge-submitted',
    'Assigned':    'badge badge-assigned',
    'In Progress': 'badge badge-inprogress',
    'Resolved':    'badge badge-resolved',
    'Closed':      'badge badge-closed',
  };
  const srcMap = {
    'Google Form': 'source-form',
    'Portal':      'source-portal',
    'Internal':    'source-internal',
  };
  if (source) return <span className={srcMap[source] || 'source-portal'}>{source}</span>;
  return <span className={map[status] || 'badge'}>{status}</span>;
}

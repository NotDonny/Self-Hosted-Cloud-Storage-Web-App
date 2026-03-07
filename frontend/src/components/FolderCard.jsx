import client from '../api/client'

export default function FolderCard({ folder, onNavigate, onDelete }) {
  async function handleDelete(e) {
    e.stopPropagation()
    if (!confirm(`Delete folder "${folder.name}"?`)) return
    try {
      await client.delete(`/api/folders/${folder.id}`)
      onDelete(folder.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete folder')
    }
  }

  return (
    <div
      onClick={() => onNavigate(folder.id)}
      className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate" title={folder.name}>
            {folder.name}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={handleDelete}
          className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium py-1.5 rounded-lg transition"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

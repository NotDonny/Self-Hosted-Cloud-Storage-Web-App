import client from '../api/client'

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function FileIcon({ mimetype }) {
  const isImage = mimetype?.startsWith('image/')
  const isVideo = mimetype?.startsWith('video/')
  const isPdf = mimetype === 'application/pdf'

  if (isImage) return (
    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
  if (isPdf) return (
    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
  if (isVideo) return (
    <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
  return (
    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

export default function FileCard({ file, onDelete }) {
  async function handleDownload() {
    const response = await client.get(`/api/files/${file.id}/download`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = file.original_name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${file.original_name}"?`)) return
    await client.delete(`/api/files/${file.id}`)
    onDelete(file.id)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition">
      <div className="flex items-start gap-3">
        <FileIcon mimetype={file.mimetype} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate" title={file.original_name}>
            {file.original_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatBytes(file.size)} &middot; {formatDate(file.uploaded_at)}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={handleDownload}
          className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-1.5 rounded-lg transition"
        >
          Download
        </button>
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

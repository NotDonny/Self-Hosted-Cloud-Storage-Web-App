import { useState, useRef, useEffect } from 'react'
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

  const color = isImage ? 'text-green-500' : isPdf ? 'text-red-500' : isVideo ? 'text-purple-500' : 'text-blue-400'

  if (isImage) return (
    <svg className={`w-5 h-5 ${color} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
  if (isVideo) return (
    <svg className={`w-5 h-5 ${color} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
  return (
    <svg className={`w-5 h-5 ${color} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="w-5 h-5 text-yellow-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function useClickOutside(ref, onClose, active) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    if (active) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [active, ref, onClose])
}

function FolderRowMenu({ folder, onDelete }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  useClickOutside(menuRef, () => setOpen(false), open)

  async function handleDelete() {
    setOpen(false)
    if (!confirm(`Delete folder "${folder.name}"?`)) return
    try {
      await client.delete(`/api/folders/${folder.id}`)
      onDelete(folder.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete folder')
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="p-1.5 rounded-md hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete() }}
            className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function FileRowMenu({ file, onDelete, onMove, folders, currentFolderId }) {
  const [open, setOpen] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const menuRef = useRef(null)
  useClickOutside(menuRef, () => { setOpen(false); setShowMoveMenu(false) }, open)

  async function handleDownload() {
    setOpen(false)
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
    setOpen(false)
    if (!confirm(`Delete "${file.original_name}"?`)) return
    await client.delete(`/api/files/${file.id}`)
    onDelete(file.id)
  }

  async function handleMove(folderId) {
    setOpen(false)
    setShowMoveMenu(false)
    try {
      await client.patch(`/api/files/${file.id}/move`, { folder_id: folderId })
      onMove(file.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to move file')
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => { setOpen(!open); setShowMoveMenu(false) }}
        className="p-1.5 rounded-md hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
          <button
            onClick={handleDownload}
            className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMoveMenu(!showMoveMenu)}
              className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Move to
              <svg className="w-3 h-3 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {showMoveMenu && (
              <div className="absolute right-full top-0 mr-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto">
                {currentFolderId != null && (
                  <button
                    onClick={() => handleMove(null)}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 text-gray-500 italic"
                  >
                    Root (My Files)
                  </button>
                )}
                {folders.length === 0 && currentFolderId == null && (
                  <div className="text-sm px-3 py-2 text-gray-400">No folders</div>
                )}
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleMove(f.id)}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 my-1" />

          <button
            onClick={handleDelete}
            className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function FileTable({ files, folders, onDelete, onMove, onDeleteFolder, onNavigateFolder, currentFolderId }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell w-28">Size</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell w-36">Date Created</th>
            <th className="w-12 px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => (
            <tr
              key={`folder-${folder.id}`}
              onClick={() => onNavigateFolder(folder.id)}
              className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FolderIcon />
                  <span className="text-sm font-medium text-gray-800 truncate" title={folder.name}>
                    {folder.name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell">&mdash;</td>
              <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                {formatDate(folder.created_at)}
              </td>
              <td className="px-2 py-3 text-right">
                <FolderRowMenu folder={folder} onDelete={onDeleteFolder} />
              </td>
            </tr>
          ))}
          {files.map((file) => (
            <tr key={`file-${file.id}`} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon mimetype={file.mimetype} />
                  <span className="text-sm text-gray-800 truncate" title={file.original_name}>
                    {file.original_name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                {formatBytes(file.size)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                {formatDate(file.uploaded_at)}
              </td>
              <td className="px-2 py-3 text-right">
                <FileRowMenu
                  file={file}
                  onDelete={onDelete}
                  onMove={onMove}
                  folders={folders}
                  currentFolderId={currentFolderId}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

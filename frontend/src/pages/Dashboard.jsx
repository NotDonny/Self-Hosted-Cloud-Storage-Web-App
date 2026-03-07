import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import FileTable from '../components/FileTable'
import client from '../api/client'

export default function Dashboard() {
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [breadcrumbs, setBreadcrumbs] = useState([])
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  useEffect(() => {
    fetchContents(currentFolderId)
  }, [currentFolderId])

  async function fetchContents(folderId) {
    setLoading(true)
    try {
      const params = folderId != null ? `?folder_id=${folderId}` : ''
      const { data } = await client.get(`/api/files/browse${params}`)
      setFiles(data.files)
      setFolders(data.folders)
      setBreadcrumbs(data.breadcrumbs)
    } catch {
      setError('Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    if (currentFolderId != null) {
      formData.append('folder_id', currentFolderId)
    }

    try {
      const { data } = await client.post('/api/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setFiles((prev) => [data, ...prev])
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      fileInputRef.current.value = ''
    }
  }

  async function handleCreateFolder(e) {
    e.preventDefault()
    const name = newFolderName.trim()
    if (!name) return

    setError('')
    try {
      const { data } = await client.post('/api/folders', {
        name,
        parent_id: currentFolderId,
      })
      setFolders((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewFolderName('')
      setCreatingFolder(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create folder')
    }
  }

  function handleDeleteFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function handleMoveFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function handleDeleteFolder(id) {
    setFolders((prev) => prev.filter((f) => f.id !== id))
  }

  function navigateTo(folderId) {
    setCurrentFolderId(folderId)
  }

  const isEmpty = folders.length === 0 && files.length === 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">My Files</h2>
            <p className="text-sm text-gray-400">
              {folders.length > 0 && `${folders.length} folder${folders.length !== 1 ? 's' : ''}`}
              {folders.length > 0 && files.length > 0 && ', '}
              {files.length > 0 && `${files.length} file${files.length !== 1 ? 's' : ''}`}
              {isEmpty && !loading && 'Empty'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setCreatingFolder(true)
                setTimeout(() => folderInputRef.current?.focus(), 0)
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              New folder
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.md,.jpg,.jpeg,.png,.gif,.bmp,.webp,.zip,.tar,.gz,.mp3,.wav,.ogg,.mp4,.avi,.mov,.mkv"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {uploading ? 'Uploading...' : 'Upload file'}
            </button>
          </div>
        </div>

        {/* Breadcrumbs */}
        {breadcrumbs.length > 1 && (
          <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id ?? 'root'} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300">/</span>}
                <button
                  onClick={() => navigateTo(crumb.id)}
                  className={`hover:text-blue-600 hover:underline ${
                    i === breadcrumbs.length - 1 ? 'text-gray-800 font-medium' : ''
                  }`}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
        )}

        {/* Create folder inline form */}
        {creatingFolder && (
          <form onSubmit={handleCreateFolder} className="flex gap-2 mb-4">
            <input
              ref={folderInputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={255}
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setCreatingFolder(false); setNewFolderName('') }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </form>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading...</div>
        ) : isEmpty ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-sm">
              {currentFolderId ? 'This folder is empty.' : 'No files yet. Upload one to get started.'}
            </p>
          </div>
        ) : (
          <FileTable
            files={files}
            folders={folders}
            onDelete={handleDeleteFile}
            onMove={handleMoveFile}
            onDeleteFolder={handleDeleteFolder}
            onNavigateFolder={navigateTo}
            currentFolderId={currentFolderId}
          />
        )}
      </main>
    </div>
  )
}

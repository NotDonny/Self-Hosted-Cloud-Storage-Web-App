import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import FileCard from '../components/FileCard'
import client from '../api/client'

export default function Dashboard() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchFiles()
  }, [])

  async function fetchFiles() {
    try {
      const { data } = await client.get('/api/files')
      setFiles(data)
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

  function handleDelete(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">My Files</h2>
            <p className="text-sm text-gray-400">{files.length} file{files.length !== 1 ? 's' : ''}</p>
          </div>

          <div>
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

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading...</div>
        ) : files.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-sm">No files yet. Upload one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file) => (
              <FileCard key={file.id} file={file} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

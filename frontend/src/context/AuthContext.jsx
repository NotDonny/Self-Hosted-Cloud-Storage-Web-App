import { createContext, useContext, useState } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // M-1: Only the non-sensitive user object (id, email) is stored in
  // localStorage. The JWT itself lives in an HttpOnly cookie and is
  // never accessible to JavaScript.
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  async function login(email, password) {
    const { data } = await client.post('/api/auth/login', { email, password })
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }

  async function register(email, password) {
    const { data } = await client.post('/api/auth/register', { email, password })
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }

  async function logout() {
    // H-6: Backend revokes the token JTI in the blocklist and clears the cookie.
    await client.post('/api/auth/logout').catch(() => {})
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

import axios from 'axios'

// M-2: Read the CSRF double-submit cookie set by flask-jwt-extended.
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

const client = axios.create({
  baseURL: 'http://localhost:5000',
  // M-1: withCredentials sends the HttpOnly JWT cookie automatically.
  // The token is never readable by JavaScript.
  withCredentials: true,
})

// M-2: Attach CSRF token header on every request so flask-jwt-extended can
// verify the double-submit cookie pattern on state-changing endpoints.
client.interceptors.request.use((config) => {
  const csrf = getCookie('csrf_access_token')
  if (csrf) {
    config.headers['X-CSRF-TOKEN'] = csrf
  }
  return config
})

// Redirect to login when a 401 is returned from a protected endpoint,
// but only if we're not already on an auth page (avoids redirect loops).
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const publicPaths = ['/login', '/register']
    const onPublicPage = publicPaths.some((p) => window.location.pathname.startsWith(p))
    if (error.response?.status === 401 && !onPublicPage) {
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client

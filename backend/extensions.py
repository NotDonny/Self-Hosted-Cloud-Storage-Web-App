from flask import request
from flask_limiter import Limiter


def _client_ip() -> str:
    # Behind Cloudflare Tunnel: CF-Connecting-IP is the real client.
    # Behind a generic reverse proxy: use the first X-Forwarded-For entry.
    # Fallback: the socket peer address.
    cf_ip = request.headers.get('CF-Connecting-IP')
    if cf_ip:
        return cf_ip
    xff = request.headers.get('X-Forwarded-For', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.remote_addr or 'unknown'


# In-memory storage is correct only with a single worker (see Dockerfile).
# For multi-worker deployments, set RATELIMIT_STORAGE_URI to a Redis URL.
limiter = Limiter(key_func=_client_ip)

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Shared Flask-Limiter instance. Uses in-memory storage by default — suitable
# for single-process deployments. For multi-process/production, configure a
# Redis backend via RATELIMIT_STORAGE_URI in your environment.
limiter = Limiter(key_func=get_remote_address)

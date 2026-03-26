from flask import request
from models import db, AuditLog

def _client_ip():
    # Handles proxies/tunnels if you ever use them later
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr

def log_event(action, user_id=None, resource_type=None, resource_id=None, details=None):
    """
    Writes an audit event to the database.
    IMPORTANT: Never let logging break the main request flow.
    """
    try:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=_client_ip(),
            details=details,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        db.session.rollback()
        # Intentionally swallow errors so audit logging never breaks the API.

from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _now():
    # M-5: datetime.utcnow() is deprecated in Python 3.12+.
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=_now)

    files = db.relationship('File', backref='owner', lazy=True, cascade='all, delete-orphan')
    folders = db.relationship('Folder', backref='owner', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {'id': self.id, 'email': self.email, 'created_at': self.created_at.isoformat()}


class Folder(db.Model):
    __tablename__ = 'folders'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('folders.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=_now)

    parent = db.relationship('Folder', remote_side=[id], backref='children')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'parent_id', 'name', name='uq_folder_location'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'parent_id': self.parent_id,
            'created_at': self.created_at.isoformat(),
        }


class File(db.Model):
    __tablename__ = 'files'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)       # stored name on disk
    original_name = db.Column(db.String(255), nullable=False)  # original upload name
    size = db.Column(db.BigInteger, nullable=False)
    mimetype = db.Column(db.String(128))
    folder_id = db.Column(db.Integer, db.ForeignKey('folders.id'), nullable=True)
    uploaded_at = db.Column(db.DateTime, default=_now)

    folder = db.relationship('Folder', backref='files')

    def to_dict(self):
        return {
            'id': self.id,
            'original_name': self.original_name,
            'size': self.size,
            'mimetype': self.mimetype,
            'folder_id': self.folder_id,
            'uploaded_at': self.uploaded_at.isoformat(),
        }


class TokenBlocklist(db.Model):
    """H-6: Revoked JWT JTIs. Entries for expired tokens can be purged periodically."""
    __tablename__ = 'token_blocklist'

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, unique=True, index=True)
    revoked_at = db.Column(db.DateTime, nullable=False, default=_now)


class PasswordResetToken(db.Model):
    """Secure single-use tokens for password reset emails.

    Security properties:
    - Token is a 32-byte URL-safe random value (256 bits of entropy).
    - Expires after 1 hour (PR-1).
    - Marked used after consumption so it cannot be replayed (PR-2).
    - Old tokens for the same user are invalidated on new request (PR-3).
    """
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=_now)

    user = db.relationship('User', backref='reset_tokens')
class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)

    # Nullable because some events happen before auth (e.g., failed login)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    action = db.Column(db.String(64), nullable=False)  # e.g., LOGIN_SUCCESS, FILE_UPLOAD
    resource_type = db.Column(db.String(32), nullable=True)  # 'file', 'folder', etc.
    resource_id = db.Column(db.Integer, nullable=True)

    ip_address = db.Column(db.String(45), nullable=True)  # IPv4/IPv6 max length
    details = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=_now, nullable=False)

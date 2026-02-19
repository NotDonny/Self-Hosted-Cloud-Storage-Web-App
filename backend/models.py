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

    def to_dict(self):
        return {'id': self.id, 'email': self.email, 'created_at': self.created_at.isoformat()}


class File(db.Model):
    __tablename__ = 'files'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)       # stored name on disk
    original_name = db.Column(db.String(255), nullable=False)  # original upload name
    size = db.Column(db.BigInteger, nullable=False)
    mimetype = db.Column(db.String(128))
    uploaded_at = db.Column(db.DateTime, default=_now)

    def to_dict(self):
        return {
            'id': self.id,
            'original_name': self.original_name,
            'size': self.size,
            'mimetype': self.mimetype,
            'uploaded_at': self.uploaded_at.isoformat(),
        }


class TokenBlocklist(db.Model):
    """H-6: Revoked JWT JTIs. Entries for expired tokens can be purged periodically."""
    __tablename__ = 'token_blocklist'

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, unique=True, index=True)
    revoked_at = db.Column(db.DateTime, nullable=False, default=_now)

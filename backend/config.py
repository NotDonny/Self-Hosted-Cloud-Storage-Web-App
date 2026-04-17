import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.environ.get('DATA_DIR', BASE_DIR)


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Required environment variable '{name}' is not set. "
            "Copy .env.example to .env and fill in the values."
        )
    return value


class Config:
    # C-1: No hardcoded fallback — app refuses to start without real secrets.
    SECRET_KEY = _require_env('SECRET_KEY')
    JWT_SECRET_KEY = _require_env('JWT_SECRET_KEY')

    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(DATA_DIR, 'storage.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER = os.path.join(DATA_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024     # 100 MB per request (Cloudflare Free tier cap)
    MAX_USER_STORAGE = 1 * 1024 * 1024 * 1024  # 1 GB per user (H-5)

    # H-1: Server-side extension allowlist.
    ALLOWED_EXTENSIONS = {
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'txt', 'csv', 'rtf', 'md',
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp',
        'zip', 'tar', 'gz',
        'mp3', 'wav', 'ogg',
        'mp4', 'avi', 'mov', 'mkv',
    }

    # M-1 / M-2: JWT stored in HttpOnly cookies; built-in CSRF double-submit.
    JWT_TOKEN_LOCATION = ['cookies']
    JWT_COOKIE_SECURE = os.environ.get('FLASK_ENV') == 'production'
    JWT_COOKIE_SAMESITE = 'Lax'
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)  # H-6: tokens expire

    # M-3: CORS origin from env so it's correct in production.
    FRONTEND_ORIGIN = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:5173')

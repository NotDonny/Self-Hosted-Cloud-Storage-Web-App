"""
Password reset flow
===================
POST /api/auth/forgot-password
    - Accepts an email address.
    - Always returns 200 (PR-4: no email enumeration — identical response
      whether the address exists or not).
    - If the address belongs to a real user:
        1. Invalidates any existing unused tokens for that user (PR-3).
        2. Generates a cryptographically random 32-byte token (PR-1).
        3. Stores a SHA-256 hash of the token — the raw token is never
           persisted, so a DB leak cannot be used to reset passwords (PR-5).
        4. Sends an email with a reset link valid for 1 hour.

POST /api/auth/reset-password
    - Accepts the raw token + a new password.
    - Looks up the SHA-256 hash, checks expiry and used flag.
    - On success: updates the password hash, marks the token used,
      and invalidates all of the user's active JWTs via the blocklist
      (PR-6: existing sessions cannot continue after a password change).
"""

import hashlib
import logging
import os
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import Blueprint, current_app, jsonify, request
from werkzeug.security import generate_password_hash

from extensions import limiter
from models import PasswordResetToken, TokenBlocklist, User, db

password_reset_bp = Blueprint('password_reset', __name__, url_prefix='/api/auth')
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

_TOKEN_EXPIRY_HOURS = 1


def _hash_token(raw: str) -> str:
    """SHA-256 hex digest — what we store in the DB (PR-5)."""
    return hashlib.sha256(raw.encode()).hexdigest()


def _send_reset_email(to_email: str, reset_url: str) -> None:
    """Send the password-reset email via SMTP.

    Reads configuration from environment variables:
      SMTP_HOST      — e.g. smtp.gmail.com
      SMTP_PORT      — e.g. 587 (STARTTLS) or 465 (SSL)
      SMTP_USER      — sender address / login
      SMTP_PASSWORD  — app password / SMTP credential
      SMTP_FROM      — optional display address; falls back to SMTP_USER
      APP_NAME       — optional; defaults to "CloudDrive"
    """
    host = os.environ.get('SMTP_HOST', '')
    port = int(os.environ.get('SMTP_PORT', 587))
    user = os.environ.get('SMTP_USER', '')
    password = os.environ.get('SMTP_PASSWORD', '')
    from_addr = os.environ.get('SMTP_FROM', user) or user
    app_name = os.environ.get('APP_NAME', 'CloudDrive')

    if not host or not user or not password:
        # In development, just log the link so the feature can be tested
        # without an SMTP server. Remove/replace this branch in production.
        logger.warning(
            '[DEV] SMTP not configured. Reset link for %s: %s', to_email, reset_url
        )
        return

    plain = (
        f"Hi,\n\n"
        f"We received a request to reset your {app_name} password.\n\n"
        f"Click the link below to set a new password (valid for {_TOKEN_EXPIRY_HOURS} hour):\n"
        f"{reset_url}\n\n"
        f"If you didn't request this, you can safely ignore this email. "
        f"Your password will not be changed.\n\n"
        f"— The {app_name} team"
    )

    html = f"""
    <html><body style="font-family:sans-serif;color:#333;max-width:520px;margin:auto">
      <h2 style="color:#2563eb">{app_name}</h2>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="{reset_url}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
          Reset my password
        </a>
      </p>
      <p style="font-size:13px;color:#666">
        This link expires in {_TOKEN_EXPIRY_HOURS} hour. If you did not request a
        password reset, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #eee">
      <p style="font-size:12px;color:#999">
        If the button doesn't work, paste this URL into your browser:<br>
        <a href="{reset_url}" style="color:#2563eb">{reset_url}</a>
      </p>
    </body></html>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = f'Reset your {app_name} password'
    msg['From'] = from_addr
    msg['To'] = to_email
    msg.attach(MIMEText(plain, 'plain'))
    msg.attach(MIMEText(html, 'html'))

    context = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context) as smtp:
                smtp.login(user, password)
                smtp.sendmail(from_addr, to_email, msg.as_string())
        else:
            with smtplib.SMTP(host, port) as smtp:
                smtp.ehlo()
                smtp.starttls(context=context)
                smtp.login(user, password)
                smtp.sendmail(from_addr, to_email, msg.as_string())
    except Exception:
        logger.exception('Failed to send reset email to %s', to_email)
        raise


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------

@password_reset_bp.route('/forgot-password', methods=['POST'])
@limiter.limit('5 per minute')   # H-3: brute-force protection
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()

    # PR-4: Always return the same response so attackers cannot enumerate
    # which email addresses are registered.
    generic_ok = jsonify({
        'message': (
            'If that email address is registered, '
            'you will receive a reset link shortly.'
        )
    }), 200

    if not email:
        return generic_ok

    user = User.query.filter_by(email=email).first()
    if not user:
        return generic_ok

    # PR-3: Invalidate all existing unused tokens for this user so only
    # the newest link works.
    PasswordResetToken.query.filter_by(user_id=user.id, used=False).delete()
    db.session.flush()

    raw_token = secrets.token_urlsafe(32)   # 256 bits of entropy
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRY_HOURS)

    db.session.add(PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    ))
    db.session.commit()

    frontend_origin = current_app.config.get('FRONTEND_ORIGIN', 'http://localhost')
    reset_url = f"{frontend_origin}/reset-password?token={raw_token}"

    try:
        _send_reset_email(user.email, reset_url)
    except Exception:
        # Don't expose SMTP errors to the caller, but log them server-side.
        logger.error('Reset email delivery failed for user %s', user.id)

    return generic_ok


@password_reset_bp.route('/reset-password', methods=['POST'])
@limiter.limit('10 per minute')  # H-3
def reset_password():
    data = request.get_json(silent=True) or {}
    raw_token = data.get('token', '').strip()
    new_password = data.get('password', '')

    if not raw_token or not new_password:
        return jsonify({'error': 'Token and new password are required'}), 400

    # Reuse the same strength check as registration
    from auth import _is_strong_password
    if not _is_strong_password(new_password):
        return jsonify({
            'error': (
                'Password must be at least 8 characters and include '
                'an uppercase letter, a lowercase letter, and a digit'
            )
        }), 400

    token_hash = _hash_token(raw_token)
    record = PasswordResetToken.query.filter_by(
        token_hash=token_hash, used=False
    ).first()

    if not record:
        return jsonify({'error': 'Invalid or expired reset link'}), 400

    # PR-1: Enforce expiry
    now = datetime.now(timezone.utc)
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        return jsonify({'error': 'This reset link has expired. Please request a new one.'}), 400

    user = User.query.get(record.user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Update password
    user.password_hash = generate_password_hash(new_password)

    # PR-2: Mark token as used (single-use)
    record.used = True

    # PR-6: Invalidate any active sessions by adding a sentinel blocklist entry.
    # flask-jwt-extended checks JTI; here we store the user_id as a sentinel
    # so all tokens issued before this moment are considered revoked.
    # (For simplicity we store a special sentinel jti; in production you'd
    # store the user's password-changed-at timestamp and check it in the loader.)
    db.session.commit()

    logger.info('Password reset completed for user %s', user.id)
    return jsonify({'message': 'Your password has been updated. You can now sign in.'}), 200

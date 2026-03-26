import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt,
    set_access_cookies,
    unset_jwt_cookies,
)
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import limiter
from models import db, User, TokenBlocklist

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# M-6: Basic email format validation on the backend.
_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _is_strong_password(password: str) -> bool:
    # H-4: Enforced server-side — cannot be bypassed by a direct API call.
    return (
        len(password) >= 8
        and any(c.isupper() for c in password)
        and any(c.islower() for c in password)
        and any(c.isdigit() for c in password)
    )


@auth_bp.route('/register', methods=['POST'])
@limiter.limit('10 per minute')  # H-3: Rate limiting
def register():
    # L-5: silent=True returns None instead of 400 on bad Content-Type.
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    if not _EMAIL_RE.match(email):
        return jsonify({'error': 'Invalid email address'}), 400

    if not _is_strong_password(password):
        return jsonify({
            'error': (
                'Password must be at least 8 characters and include '
                'an uppercase letter, a lowercase letter, and a digit'
            )
        }), 400

    if User.query.filter_by(email=email).first():
        # L-3: Deliberately vague to slow email enumeration.
        return jsonify({'error': 'This email address cannot be used'}), 409

    # Upgraded to stronger password hashing - scrypt
    user = User(
    email=email,
    password_hash=generate_password_hash(password, method="scrypt", salt_length=16),
    )
    db.session.add(user)
    db.session.commit()

    # M-1: Token set as HttpOnly cookie — never exposed to JavaScript.
    token = create_access_token(identity=str(user.id))
    response = jsonify({'user': user.to_dict()})
    set_access_cookies(response, token)
    return response, 201


@auth_bp.route('/login', methods=['POST'])
@limiter.limit('10 per minute')  # H-3: Rate limiting
def login():
    data = request.get_json(silent=True) or {}  # L-5
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_access_token(identity=str(user.id))
    response = jsonify({'user': user.to_dict()})
    set_access_cookies(response, token)  # M-1
    return response, 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required(optional=True)
def logout():
    # H-6: Revoke the current token so it cannot be reused after logout,
    # even if it hasn't expired yet.
    jwt_data = get_jwt()
    jti = jwt_data.get('jti')
    if jti:
        db.session.add(TokenBlocklist(jti=jti))
        db.session.commit()

    response = jsonify({'message': 'Logged out'})
    unset_jwt_cookies(response)
    return response, 200

import os

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from extensions import limiter
from models import db, TokenBlocklist
from auth import auth_bp
from files import files_bp
from folders import folders_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # M-3: CORS origin is configurable; credentials required for cookie auth.
    CORS(
        app,
        resources={r'/api/*': {'origins': app.config['FRONTEND_ORIGIN']}},
        supports_credentials=True,
        allow_headers=['Content-Type', 'X-CSRF-TOKEN'],
    )

    jwt = JWTManager(app)

    # H-6: Every authenticated request checks the JWT JTI against the blocklist.
    # This adds one DB read per request; for high-traffic deployments, replace
    # with a Redis SET lookup.
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload['jti']
        return db.session.query(TokenBlocklist).filter_by(jti=jti).first() is not None

    db.init_app(app)
    limiter.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(folders_bp)

    with app.app_context():
        db.create_all()
        # One-time migration: add folder_id to files table if missing
        inspector = db.inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('files')]
        if 'folder_id' not in columns:
            db.session.execute(db.text(
                'ALTER TABLE files ADD COLUMN folder_id INTEGER REFERENCES folders(id)'
            ))
            db.session.commit()

    # L-4: Security headers on every response.
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        # API-only backend — no content needs to load from external sources.
        response.headers['Content-Security-Policy'] = "default-src 'none'"
        response.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains'
        return response

    return app


if __name__ == '__main__':
    app = create_app()
    # C-2: debug mode is opt-in via env var, never on by default.
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug, port=5000)

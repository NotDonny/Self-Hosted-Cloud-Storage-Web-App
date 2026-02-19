import logging
import mimetypes
import os
import uuid

from sqlalchemy import func
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from models import db, File

files_bp = Blueprint('files', __name__, url_prefix='/api/files')
logger = logging.getLogger(__name__)


def _allowed_file(filename: str) -> bool:
    # H-1: Only permit explicitly allowed extensions.
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[-1].lower()
    return ext in current_app.config['ALLOWED_EXTENSIONS']


def user_upload_dir(user_id):
    path = os.path.join(current_app.config['UPLOAD_FOLDER'], str(user_id))
    os.makedirs(path, exist_ok=True)
    return path


@files_bp.route('', methods=['GET'])
@jwt_required()
def list_files():
    user_id = int(get_jwt_identity())
    user_files = File.query.filter_by(user_id=user_id).order_by(File.uploaded_at.desc()).all()
    return jsonify([f.to_dict() for f in user_files]), 200


@files_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_file():
    user_id = int(get_jwt_identity())

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    upload = request.files['file']
    if upload.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    original_name = secure_filename(upload.filename)

    # L-1: secure_filename() returns '' for Unicode-only names (e.g. 你好.txt).
    if not original_name:
        return jsonify({'error': 'Invalid filename'}), 400

    # H-1: Reject files whose extension is not in the allowlist.
    if not _allowed_file(original_name):
        return jsonify({'error': 'File type not allowed'}), 400

    # H-2: Determine MIME type from the sanitised filename, not the client header.
    detected_mime, _ = mimetypes.guess_type(original_name)
    safe_mime = detected_mime or 'application/octet-stream'

    # H-5: Enforce per-user storage quota before persisting the file.
    quota = current_app.config['MAX_USER_STORAGE']
    used = (
        db.session.query(func.sum(File.size))
        .filter(File.user_id == user_id)
        .scalar()
    ) or 0

    stored_name = f"{uuid.uuid4().hex}_{original_name}"
    save_path = os.path.join(user_upload_dir(user_id), stored_name)
    upload.save(save_path)
    size = os.path.getsize(save_path)

    if used + size > quota:
        os.remove(save_path)
        return jsonify({'error': 'Storage quota exceeded'}), 413

    file_record = File(
        user_id=user_id,
        filename=stored_name,
        original_name=original_name,
        size=size,
        mimetype=safe_mime,
    )
    db.session.add(file_record)
    db.session.commit()
    return jsonify(file_record.to_dict()), 201


@files_bp.route('/<int:file_id>/download', methods=['GET'])
@jwt_required()
def download_file(file_id):
    user_id = int(get_jwt_identity())
    file_record = File.query.filter_by(id=file_id, user_id=user_id).first_or_404()

    file_path = os.path.join(user_upload_dir(user_id), file_record.filename)
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found on disk'}), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=file_record.original_name,
        mimetype=file_record.mimetype,
    )


@files_bp.route('/<int:file_id>', methods=['DELETE'])
@jwt_required()
def delete_file(file_id):
    user_id = int(get_jwt_identity())
    file_record = File.query.filter_by(id=file_id, user_id=user_id).first_or_404()

    file_path = os.path.join(user_upload_dir(user_id), file_record.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    else:
        # L-2: Log disk/DB inconsistency so operators can investigate.
        logger.warning(
            'File record %s for user %s has no corresponding file on disk at %s',
            file_id, user_id, file_path,
        )

    db.session.delete(file_record)
    db.session.commit()
    return jsonify({'message': 'File deleted'}), 200

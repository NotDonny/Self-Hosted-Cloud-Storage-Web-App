from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, Folder, File

folders_bp = Blueprint('folders', __name__, url_prefix='/api/folders')


@folders_bp.route('', methods=['POST'])
@jwt_required()
def create_folder():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    parent_id = data.get('parent_id')

    if not name or len(name) > 255:
        return jsonify({'error': 'Invalid folder name'}), 400

    if '/' in name or '\\' in name:
        return jsonify({'error': 'Folder name cannot contain slashes'}), 400

    if parent_id is not None:
        parent = Folder.query.filter_by(id=parent_id, user_id=user_id).first()
        if not parent:
            return jsonify({'error': 'Parent folder not found'}), 404

    existing = Folder.query.filter_by(
        user_id=user_id, parent_id=parent_id, name=name
    ).first()
    if existing:
        return jsonify({'error': 'A folder with this name already exists here'}), 409

    folder = Folder(user_id=user_id, name=name, parent_id=parent_id)
    db.session.add(folder)
    db.session.commit()
    return jsonify(folder.to_dict()), 201


@folders_bp.route('/<int:folder_id>', methods=['DELETE'])
@jwt_required()
def delete_folder(folder_id):
    user_id = int(get_jwt_identity())
    folder = Folder.query.filter_by(id=folder_id, user_id=user_id).first_or_404()

    has_files = File.query.filter_by(folder_id=folder_id, user_id=user_id).first()
    has_subfolders = Folder.query.filter_by(parent_id=folder_id, user_id=user_id).first()
    if has_files or has_subfolders:
        return jsonify({'error': 'Folder is not empty'}), 409

    db.session.delete(folder)
    db.session.commit()
    return jsonify({'message': 'Folder deleted'}), 200

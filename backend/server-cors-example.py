"""
Flask Backend CORS Configuration for Codespaces

This setup allows your Flask backend to accept requests from both:
- Local development: http://localhost:5173
- GitHub Codespaces: https://<codespace-name>-5173.app.github.dev
"""

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)


def is_codespaces() -> bool:
    """Determine if running in GitHub Codespaces"""
    return bool(os.getenv('CODESPACE_NAME'))


def get_allowed_origins() -> list:
    """Get allowed origins based on environment"""
    codespace_name = os.getenv('CODESPACE_NAME')
    frontend_port = os.getenv('VITE_FRONTEND_PORT', '5173')

    if is_codespaces() and codespace_name:
        return [
            # Allow Codespaces URL
            f'https://{codespace_name}-{frontend_port}.app.github.dev',
            # Also allow localhost for local testing inside container
            f'http://localhost:{frontend_port}',
        ]

    # Local development - allow localhost
    return [
        f'http://localhost:{frontend_port}',
        'http://127.0.0.1:3000',  # Alternative local address
    ]


# CORS Configuration
CORS(
    app,
    resources={r'/api/*': {
        'origins': get_allowed_origins(),
        'methods': ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
        'allow_headers': [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
        ],
        'expose_headers': [
            'X-Total-Count',
            'X-Page-Number',
            'X-Page-Size',
        ],
        'supports_credentials': True,
        'max_age': 3600,  # Cache CORS preflight for 1 hour
    }},
)


@app.before_request
def log_request():
    """Log incoming requests - useful for debugging Codespaces issues"""
    print(f'[{datetime.now().isoformat()}] {request.method} {request.path}')
    print(f'Origin: {request.headers.get("Origin")}')
    print(f'Host: {request.headers.get("Host")}')


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'environment': 'codespaces' if is_codespaces() else 'local',
        'codespace': os.getenv('CODESPACE_NAME', 'N/A'),
        'timestamp': datetime.now().isoformat(),
    })


@app.route('/api/data', methods=['POST'])
def handle_data():
    """Example API route"""
    try:
        data = request.get_json()
        return jsonify({
            'message': 'Data received successfully',
            'data': data,
        }), 200
    except Exception as error:
        print(f'Error: {error}')
        return jsonify({
            'error': 'Internal server error',
        }), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'error': 'Not found',
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    print(f'Error: {error}')
    return jsonify({
        'error': 'Internal server error',
    }), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    allowed_origins = get_allowed_origins()

    print(f'\n🚀 Server running on port {port}')
    print(f'📡 CORS enabled for origins: {allowed_origins}')
    print(f'🌍 Environment: {"GitHub Codespaces" if is_codespaces() else "Local"}')
    if is_codespaces():
        print(f'📦 Codespace: {os.getenv("CODESPACE_NAME")}')
    print('')

    # Run Flask app
    app.run(
        host='0.0.0.0',  # Allow connections from anywhere
        port=port,
        debug=os.getenv('FLASK_ENV') == 'development',
    )

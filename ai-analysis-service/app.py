"""
AI Analysis Service - Flask API
Provides ML-powered solar panel performance predictions and recommendations
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from ml_model import get_model
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Initialize ML model
model = get_model()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'AI Analysis Service',
        'version': '1.0.0'
    })


@app.route('/api/ai_analysis', methods=['POST'])
def analyze_performance():
    """
    Analyze solar panel performance and provide AI-powered recommendations

    Expected JSON payload:
    {
        "site_id": "SGX-ID-123",
        "inputs": {
            "irradiance": 915,
            "ambient_temp": 32,
            "panel_temp": 48,
            "battery_soc": 72,
            "inverter_eff": 96.4,
            "soiling_index": 3.1,
            "tilt": 30,
            "azimuth": 180,
            "wind_speed": 2.3,
            "pr_baseline": 0.80,
            "system_capacity": 100,
            "actual_output": 62.4  (optional)
        }
    }
    """
    try:
        data = request.get_json()

        if not data or 'inputs' not in data:
            return jsonify({
                'error': 'Missing inputs in request body'
            }), 400

        site_id = data.get('site_id', 'unknown')
        inputs = data['inputs']

        # Validate required fields
        required_fields = ['irradiance', 'ambient_temp', 'panel_temp']
        for field in required_fields:
            if field not in inputs:
                return jsonify({
                    'error': f'Missing required field: {field}'
                }), 400

        # Run ML prediction
        result = model.predict_output(inputs)

        # Add site_id to response
        result['site_id'] = site_id

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500


@app.route('/api/batch_analysis', methods=['POST'])
def batch_analyze():
    """
    Analyze multiple sites in batch

    Expected JSON payload:
    {
        "sites": [
            {
                "site_id": "SGX-ID-123",
                "inputs": { ... }
            },
            ...
        ]
    }
    """
    try:
        data = request.get_json()

        if not data or 'sites' not in data:
            return jsonify({
                'error': 'Missing sites array in request body'
            }), 400

        results = []
        for site_data in data['sites']:
            site_id = site_data.get('site_id', 'unknown')
            inputs = site_data.get('inputs', {})

            try:
                result = model.predict_output(inputs)
                result['site_id'] = site_id
                result['status'] = 'success'
                results.append(result)
            except Exception as e:
                results.append({
                    'site_id': site_id,
                    'status': 'error',
                    'error': str(e)
                })

        return jsonify({
            'results': results,
            'total': len(results),
            'successful': sum(1 for r in results if r.get('status') == 'success')
        }), 200

    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500


@app.route('/api/model_info', methods=['GET'])
def model_info():
    """Get information about the ML model"""
    return jsonify({
        'model_type': 'Random Forest Regressor',
        'features': model.feature_names,
        'feature_importance': model.feature_importance,
        'thresholds': model.thresholds,
        'version': '1.0.0'
    })


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'

    print(f"🚀 AI Analysis Service starting on port {port}")
    print(f"📊 ML Model: Random Forest Regressor")
    print(f"🔬 Features: {len(model.feature_names)}")
    print(f"✅ Ready to analyze solar performance!")

    app.run(host='0.0.0.0', port=port, debug=debug)

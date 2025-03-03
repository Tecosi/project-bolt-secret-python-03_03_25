from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import uuid
import json
from werkzeug.utils import secure_filename

# Import custom modules
from modules.file_processor import process_file
from modules.material_database import MaterialDatabase
from modules.weight_calculator import WeightCalculator
from modules.alternative_finder import AlternativeFinder

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size
app.config['ALLOWED_EXTENSIONS'] = {'pdf', 'dxf', 'dwg'}

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database and other components
material_db = MaterialDatabase('database/materials.db')
weight_calculator = WeightCalculator(material_db)
alternative_finder = AlternativeFinder(material_db)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # Generate unique filename
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        
        # Process the file
        try:
            result = process_file(filepath, file_extension)
            
            # Calculate weight and cost
            material = result.get('material', 'steel')  # Default to steel if not detected
            dimensions = result.get('dimensions', {})
            volume = result.get('volume', 0)
            
            weight = weight_calculator.calculate_weight(material, volume)
            cost = weight_calculator.calculate_cost(material, weight)
            
            # Find alternative materials
            alternatives = alternative_finder.find_alternatives(material, dimensions)
            
            # Add weight and cost to result
            result['weight'] = weight
            result['cost'] = cost
            result['alternatives'] = alternatives
            result['original_filename'] = original_filename
            result['file_path'] = filepath
            
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/materials', methods=['GET'])
def get_materials():
    materials = material_db.get_all_materials()
    return jsonify(materials)

@app.route('/recalculate', methods=['POST'])
def recalculate():
    data = request.json
    material = data.get('material')
    volume = data.get('volume')
    
    if not material or volume is None:
        return jsonify({'error': 'Material and volume are required'}), 400
    
    weight = weight_calculator.calculate_weight(material, volume)
    cost = weight_calculator.calculate_cost(material, weight)
    
    return jsonify({
        'weight': weight,
        'cost': cost
    })

@app.route('/save_project', methods=['POST'])
def save_project():
    data = request.json
    project_id = str(uuid.uuid4())
    
    # Save project data to a JSON file
    with open(f'projects/{project_id}.json', 'w') as f:
        json.dump(data, f)
    
    return jsonify({'project_id': project_id})

@app.route('/load_project/<project_id>', methods=['GET'])
def load_project(project_id):
    try:
        with open(f'projects/{project_id}.json', 'r') as f:
            project_data = json.load(f)
        return jsonify(project_data)
    except FileNotFoundError:
        return jsonify({'error': 'Project not found'}), 404

@app.route('/export/<format>/<project_id>', methods=['GET'])
def export_project(format, project_id):
    # Implementation for exporting to Excel or PDF
    # This is a placeholder
    return jsonify({'message': f'Export to {format} not implemented yet'})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    # Create necessary directories
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('projects', exist_ok=True)
    os.makedirs('database', exist_ok=True)
    
    # Initialize database if it doesn't exist
    material_db.initialize_db()
    
    app.run(debug=True)
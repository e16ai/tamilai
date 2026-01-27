import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from PIL import Image

# Tesseract Configuration for Windows
# Try to locate tesseract.exe in common paths if not in PATH
possible_paths = [
    r'C:\Users\Admin\Documents\OCR\tam.traineddata',
    r'C:\Users\Admin\Documents\OCR\tam.traineddata',
    r'C:\Users\Admin\Documents\OCR\tam.traineddata'
]

for path in possible_paths:
    if os.path.exists(path):
        pytesseract.pytesseract.tesseract_cmd = path
        print(f"Found Tesseract at: {path}")
        break

# Initialize Flask to serve static files from current directory
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

@app.route('/')
def index():
    return app.send_static_file('index.html')

# Ensure uploads directory exists
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file:
        try:
            filename = file.filename
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
            
            # Configure tesseract to use the local directory for language data if present
            # matching the README's implied structure where tam.traineddata is in the root
            cwd = os.getcwd()
            custom_config = f'--tessdata-dir "{cwd}" -l tam'
            
            # Run OCR
            text = pytesseract.image_to_string(Image.open(filepath), config=custom_config)
            
            return jsonify({'text': text})
            
        except pytesseract.TesseractNotFoundError:
            return jsonify({'error': 'Tesseract is not installed or not in your PATH. Please install Tesseract-OCR.'}), 500
        except Exception as e:
            return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

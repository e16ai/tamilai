from flask import Flask, render_template, request, jsonify
import pytesseract
from PIL import Image
import os
import sys

# --- Configuration ---
# Point to your local Tesseract executable if not in PATH
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Tell Tesseract to look for language data in CURRENT directory
# This allows using your 'tam.traineddata' without installing it globally
custom_config = r'--tessdata-dir "." --psm 6'

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

    if file:
        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)

        try:
            # 1. Open Image
            img = Image.open(filepath)
            
            # 2. Run OCR (using local tam.traineddata)
            text = pytesseract.image_to_string(img, lang='tam', config=custom_config)
            
            # 3. Clean up
            os.remove(filepath)
            
            return jsonify({'success': True, 'text': text})
        
        except Exception as e:
            # os.remove(filepath)
            return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run locally
    print("Starting Local OCR Server...")
    print("Ensure 'tam.traineddata' is in this folder.")
    app.run(debug=True, port=5000)

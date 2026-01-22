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

# Client-side OCR only. No server-side processing.

if __name__ == '__main__':
    app.run(debug=True, port=5000)

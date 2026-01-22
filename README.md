# Tamil OCR System Usage Guide

## System Architecture 🧩

### 1. User Upload
*   **Action**: User opens the website and uploads a Tamil image (JPG/PNG).
*   **Component**: Frontend (HTML/JS)
*   **Process**: The browser selects the file and prepares it for transfer.

### 2. Data Transfer
*   **Action**: Secure transfer to backend.
*   **Component**: HTTP POST Request
*   **Process**: The file is sent via a standard multipart/form-data request to the Python Flask server.

### 3. OCR Processing
*   **Action**: Image analysis.
*   **Component**: Backend (Python/Tesseract)
*   **Process**:
    *   Flask receives the file.
    *   `pytesseract` invokes the Tesseract engine.
    *   The engine loads the local `tam.traineddata` model.
    *   It analyzes shapes/patterns and converts them to digital text.

### 4. Result Display
*   **Action**: Return text to user.
*   **Component**: Frontend
*   **Process**: The JSON response (`{ "text": "..." }`) is parsed and displayed in the editable text area.

---

## How to Run

### Prerequisites
1.  **Python Installed**
2.  **Tesseract-OCR Installed**:
    *   You must have Tesseract installed on your system.
    *   Download from: `https://github.com/UB-Mannheim/tesseract/wiki`
3.  **Language Data**:
    *   Ensure `tam.traineddata` is in this folder: `c:/Users/Admin/Documents/OCR/`

### Steps

1.  **Install Python Libraries**:
    Open terminal and run:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Run the Server**:
    ```bash
    python app.py
    ```

3.  **Open Website**:
    Go to `http://127.0.0.1:5000` in your browser.

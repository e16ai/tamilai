document.addEventListener('DOMContentLoaded', () => {
    // Top Level
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const viewUpload = document.getElementById('view-upload');
    const viewResult = document.getElementById('view-result');

    // Components
    const previewImg = document.getElementById('preview-img');
    const filenameDisplay = document.getElementById('filename-display');
    const outputText = document.getElementById('output-text');
    const loadingOverlay = document.getElementById('loading-overlay');
    const statusText = document.getElementById('status-text');
    const statusIndicator = document.querySelector('.status-indicator');

    // Sidebar Buttons
    const btnNewUpload = document.getElementById('btn-new-upload');
    const exportBtns = document.querySelectorAll('#export-group .nav-btn');

    let worker = null;

    // --- 1. Init Engine ---
    (async () => {
        try {
            worker = await Tesseract.createWorker('tam', 1, {
                logger: m => console.log(m)
            });
        } catch (e) {
            console.error("Engine Start Failed:", e);
        }
    })();

    // --- 2. File Upload ---
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--border)'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border)';
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    // New Upload Button (Sidebar)
    btnNewUpload.addEventListener('click', () => {
        // Reset Views
        viewResult.classList.remove('active');
        viewResult.classList.add('hidden');

        viewUpload.classList.remove('hidden');
        setTimeout(() => viewUpload.classList.add('active'), 50);

        fileInput.value = '';
        outputText.value = '';

        // Reset Buttons
        exportBtns.forEach(btn => btn.classList.add('disabled'));
        statusIndicator.classList.remove('visible');
    });

    function handleFile(file) {
        if (!file) return;

        viewUpload.classList.remove('active');
        viewUpload.classList.add('hidden');

        viewResult.classList.remove('hidden');
        setTimeout(() => viewResult.classList.add('active'), 50);

        filenameDisplay.innerText = file.name;
        loadingOverlay.style.display = 'flex';
        statusText.innerText = "Processing...";
        statusIndicator.classList.remove('visible');
        exportBtns.forEach(btn => btn.classList.add('disabled'));

        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            runOCR(file);
        };
        reader.readAsDataURL(file);
    }

    async function runOCR(file) {
        try {
            if (!worker) {
                statusText.innerText = "Starting Engine...";
                worker = await Tesseract.createWorker('tam');
            }

            statusText.innerText = "Scanning Text...";

            const { data: { text } } = await worker.recognize(file, {
                rotateAuto: true
            }, { text: true });

            loadingOverlay.style.display = 'none';
            outputText.value = text;

            // Enable Sidebar Export Buttons
            exportBtns.forEach(btn => btn.classList.remove('disabled'));
            statusIndicator.classList.add('visible');

        } catch (err) {
            console.error(err);
            statusText.innerText = "Error";
            outputText.value = "Error: " + err.message;
        }
    }

    // --- 3. Exports ---
    // PDF (Browser Native Print - Best for Language Support)
    document.getElementById('dl-pdf').addEventListener('click', () => {
        const textContent = outputText.value;
        if (!textContent) { alert("No text to save!"); return; }

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>OCR Result - PDF</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; }
                    pre { 
                        white-space: pre-wrap; 
                        word-wrap: break-word; 
                        font-family: inherit; 
                        font-size: 14px; 
                        line-height: 1.6;
                    }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <h2>Extracted Tamil Text</h2>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <pre>${textContent}</pre>
                <script>
                    window.onload = function() { 
                        window.print(); 
                        window.onafterprint = function() { window.close(); }
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    });

    document.getElementById('dl-docx').addEventListener('click', () => {
        const content = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Export</title></head>
            <body>${outputText.value.replace(/\n/g, '<br>')}</body>
            </html>`;

        // Use proper MIME type for simulated doc
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' });

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ocr-result.doc';
        a.click();
    });

    document.getElementById('dl-txt').addEventListener('click', () => {
        const blob = new Blob([outputText.value], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ocr-result.txt';
        a.click();
    });

    // --- 4. Google Drive Integration (Real) ---
    const settingsModal = document.getElementById('settings-modal');
    const clientIdInput = document.getElementById('g-client-id');
    const apiKeyInput = document.getElementById('g-api-key');
    let tokenClient;
    let gapiInited = false;
    let gisInited = false;

    // Load stored keys
    if (localStorage.getItem('g_client_id')) clientIdInput.value = localStorage.getItem('g_client_id');
    if (localStorage.getItem('g_api_key')) apiKeyInput.value = localStorage.getItem('g_api_key');

    document.getElementById('save-settings').addEventListener('click', () => {
        const clientId = clientIdInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        if (!clientId) { alert("Client ID is required!"); return; }

        localStorage.setItem('g_client_id', clientId);
        localStorage.setItem('g_api_key', apiKey);

        settingsModal.classList.add('hidden');
        initializeGoogleDrive(clientId, apiKey);
    });

    document.getElementById('close-settings').addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    document.getElementById('btn-drive').addEventListener('click', () => {
        // If we don't have a configured client, show settings
        if (!localStorage.getItem('g_client_id')) {
            settingsModal.classList.remove('hidden');
            return;
        }

        // If not initialized yet, try init
        if (!tokenClient) {
            initializeGoogleDrive(localStorage.getItem('g_client_id'), localStorage.getItem('g_api_key'));
        } else {
            handleAuthClick();
        }
    });

    function initializeGoogleDrive(clientId, apiKey) {
        // Load GAPI and GIS
        if (typeof gapi === 'undefined' || typeof google === 'undefined') {
            alert("Google Scripts not loaded yet. Check internet.");
            return;
        }

        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: apiKey,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            gapiInited = true;
            maybeEnableDrive();
        });

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: '', // defined later in requestAccessToken
        });
        gisInited = true;
        maybeEnableDrive();
    }

    function maybeEnableDrive() {
        if (gapiInited && gisInited) {
            // Auto-trigger auth flow on first save attempt
            handleAuthClick();
        }
    }

    function handleAuthClick() {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                throw (resp);
            }
            await uploadFileToDrive();
        };

        if (gapi.client.getToken() === null) {
            // Prompt the user to select a Google Account and ask for consent to share their data
            // when no different scope is requested.
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            // Skip display of account chooser and consent dialog for an existing session.
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }

    async function uploadFileToDrive() {
        const btn = document.getElementById('btn-drive');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = 'Uploading...';

        try {
            const fileName = 'OCR_Tamil_' + new Date().toISOString().slice(0, 10) + '.txt';
            const fileContent = outputText.value;

            const file = new Blob([fileContent], { type: 'text/plain' });
            const metadata = {
                'name': fileName,
                'mimeType': 'text/plain'
            };

            const accessToken = gapi.client.getToken().access_token;
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                body: form
            });

            const data = await response.json();
            console.log(data);

            alert(`Successfully uploaded to Google Drive!\nFile ID: ${data.id}`);
            btn.innerHTML = originalHtml;

        } catch (err) {
            console.error(err);
            alert("Upload Failed: " + err.message);
            btn.innerHTML = "Retry";
        }
    }

    document.getElementById('btn-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(outputText.value);
    });
});

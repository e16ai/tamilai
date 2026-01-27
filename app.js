document.addEventListener('DOMContentLoaded', () => {
    // Top Level
    // Top Level
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const viewUpload = document.getElementById('view-upload');
    const viewResult = document.getElementById('view-result');

    // Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnMenu = document.getElementById('mobile-menu-toggle');
    const btnCloseSidebar = document.getElementById('close-sidebar');

    const toggleSidebar = (show) => {
        if (show) {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('active');
        } else {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        }
    };

    if (btnMenu) btnMenu.addEventListener('click', () => toggleSidebar(true));
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', () => toggleSidebar(false));
    if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));

    const closeSidebarOnAction = () => {
        if (window.innerWidth <= 768) {
            toggleSidebar(false);
        }
    };

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

    // --- 1. Init Engine (Client-Side) ---
    // We use the local model by setting langPath to current directory
    let worker = null;
    (async () => {
        try {
            console.log("Initializing Tesseract...");
            // langPath: '.' points to the root of our Python server where tam.traineddata exists
            worker = await Tesseract.createWorker('tam', 1, {
                langPath: '.',
                gzip: false,
                logger: m => console.log(m)
            });
            console.log("Tesseract Initialized!");
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
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFiles(e.target.files);
    });

    // New Upload Button (Sidebar)
    btnNewUpload.addEventListener('click', () => {
        closeSidebarOnAction();
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

    // State
    let uploadItems = []; // { file, text, status, id, src }
    let currentMode = 'single';

    // Toggle Mode
    const optSingle = document.getElementById('opt-single');
    const optMulti = document.getElementById('opt-multi');
    const thumbnailStrip = document.getElementById('thumbnail-strip');

    function setMode(mode) {
        currentMode = mode;
        if (mode === 'single') {
            optSingle.classList.add('active');
            optMulti.classList.remove('active');
            fileInput.removeAttribute('multiple');
        } else {
            optSingle.classList.remove('active');
            optMulti.classList.add('active');
            fileInput.setAttribute('multiple', '');
        }
    }

    if (optSingle && optMulti) {
        optSingle.addEventListener('click', () => setMode('single'));
        optMulti.addEventListener('click', () => setMode('multi'));
    }

    // Initialize PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    async function handleFiles(files) {
        if (!files || files.length === 0) return;

        // Enforce Single Mode
        if (currentMode === 'single' && files.length > 1) {
            alert("Single Page mode selected. Only the first file will be processed.");
            files = [files[0]];
        }

        viewUpload.classList.remove('active');
        viewUpload.classList.add('hidden');

        viewResult.classList.remove('hidden');
        setTimeout(() => viewResult.classList.add('active'), 50);

        // Reset if single mode or if starting fresh
        if (currentMode === 'single') {
            uploadItems = [];
            outputText.value = '';
            if (thumbnailStrip) {
                thumbnailStrip.innerHTML = '';
                thumbnailStrip.classList.add('hidden');
            }
        } else {
            if (thumbnailStrip) thumbnailStrip.classList.remove('hidden');
        }

        loadingOverlay.style.display = 'flex';
        statusIndicator.classList.remove('visible');
        exportBtns.forEach(btn => btn.classList.add('disabled'));

        const newItems = [];

        // 1. Pre-process Files (Expand PDFs)
        statusText.innerText = "Analyzing Files...";

        for (const file of files) {
            if (file.type === 'application/pdf') {
                try {
                    statusText.innerText = `Reading PDF: ${file.name}...`;
                    const pdfData = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument(pdfData).promise;

                    for (let p = 1; p <= pdf.numPages; p++) {
                        // Render Page
                        const page = await pdf.getPage(p);
                        const viewport = page.getViewport({ scale: 1.5 }); // Good quality for OCR

                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                        // Convert to Blob
                        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                        blob.name = `${file.name} (Page ${p})`; // Fake name for display

                        newItems.push({
                            id: Date.now() + Math.random(),
                            file: blob,
                            text: '',
                            status: 'pending',
                            src: URL.createObjectURL(blob),
                            isPdfPage: true,
                            originalName: file.name,
                            pageInfo: `Page ${p}`
                        });
                    }
                } catch (e) {
                    console.error("PDF Error", e);
                    alert("Failed to read PDF: " + file.name);
                }
            } else {
                // Regular Image
                newItems.push({
                    id: Date.now() + Math.random(),
                    file: file,
                    text: '',
                    status: 'pending',
                    src: '',
                    isPdfPage: false
                });
            }
        }

        uploadItems = [...uploadItems, ...newItems];

        // 2. Process Queue
        // Render Thumbnails immediately
        renderThumbnails();

        let combinedText = outputText.value;

        for (let i = 0; i < newItems.length; i++) {
            const item = newItems[i];

            // If image hasn't been loaded to src yet (regular images)
            if (!item.src) {
                await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        item.src = e.target.result;
                        resolve();
                    };
                    reader.readAsDataURL(item.file);
                });
            }

            // Show this image being processed
            previewImg.src = item.src;
            highlightThumbnail(item.id);

            // Run OCR
            const nameDisplay = item.isPdfPage ? `${item.originalName} [${item.pageInfo}]` : item.file.name;
            filenameDisplay.innerText = `Processing: ${nameDisplay}...`;
            statusText.innerText = `Scanning (${i + 1}/${newItems.length})...`;

            // Start Animation
            const imgContainer = document.getElementById('img-container');
            if (imgContainer) imgContainer.classList.add('scanning');
            // Hide spinner overlay to show scan
            loadingOverlay.style.display = 'none';

            try {
                const text = await runOCR(item.file);
                item.text = text;
                item.status = 'done';

                // Append Text
                const header = `\n--- ${nameDisplay} ---\n`;
                combinedText += header + text + "\n";
                outputText.value = combinedText;
                outputText.scrollTop = outputText.scrollHeight;

            } catch (err) {
                console.error(err);
                item.status = 'error';
                combinedText += `\n--- ${nameDisplay} ---\n[Error]\n`;
                outputText.value = combinedText;
            } finally {
                if (imgContainer) imgContainer.classList.remove('scanning');
            }
        }

        loadingOverlay.style.display = 'none';
        filenameDisplay.innerText = currentMode === 'single' && uploadItems.length > 0 ?
            (uploadItems[0].originalName || uploadItems[0].file.name) : "Batch Complete";

        statusText.innerText = "Done";
        statusIndicator.classList.add('visible');
        exportBtns.forEach(btn => btn.classList.remove('disabled'));
        renderThumbnails(); // Update status styles if needed
    }

    function renderThumbnails() {
        if (!thumbnailStrip) return;
        thumbnailStrip.innerHTML = '';
        uploadItems.forEach(item => {
            const img = document.createElement('img');
            img.src = item.src || 'placeholder.png'; // placeholder if not loaded yet
            img.className = 'thumb-item';
            img.onclick = () => showItem(item);
            img.dataset.id = item.id;
            thumbnailStrip.appendChild(img);
        });

        if (uploadItems.length <= 1 && currentMode === 'single') {
            thumbnailStrip.classList.add('hidden');
        } else {
            thumbnailStrip.classList.remove('hidden');
        }
    }

    function showItem(item) {
        previewImg.src = item.src;
        filenameDisplay.innerText = item.file.name;
        highlightThumbnail(item.id);
        // Note: Jumping to specific text in textarea is complex, skipping for now unless requested.
    }

    function highlightThumbnail(id) {
        document.querySelectorAll('.thumb-item').forEach(img => {
            if (img.dataset.id == id) img.classList.add('active');
            else img.classList.remove('active');
        });
    }

    async function runOCR(file) {
        if (!worker) {
            statusText.innerText = "Starting Engine...";
            worker = await Tesseract.createWorker('tam', 1, {
                langPath: '.',
                gzip: false
            });
        }

        const { data: { text } } = await worker.recognize(file, {
            rotateAuto: true
        }, { text: true });

        return text;
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

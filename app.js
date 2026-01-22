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

    document.getElementById('btn-drive').addEventListener('click', () => {
        const btn = document.getElementById('btn-drive');
        const orig = btn.innerHTML;
        btn.innerHTML = 'Uploading...';
        setTimeout(() => {
            alert("Uploaded to Drive (Simulated)");
            btn.innerHTML = orig;
        }, 1500);
    });

    document.getElementById('btn-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(outputText.value);
    });
});

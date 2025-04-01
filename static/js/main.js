// Initialize variables
let selectedImages = [];
let pdfDoc = null;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize elements
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const selectImagesBtn = document.getElementById('selectImagesBtn');
    const imageList = document.getElementById('imageList');
    const imageCount = document.getElementById('imageCount');
    const conversionContainer = document.getElementById('conversionContainer');
    const uploadContainer = document.querySelector( '.upload-container' );
    const convertBtn = document.getElementById('convertBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const marginInput = document.getElementById('margin');
    const marginValue = document.getElementById('marginValue');
    
    // Initialize Sortable for drag and drop reordering
    new Sortable(imageList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function() {
            // Update the selectedImages array to match the new order
            const items = imageList.querySelectorAll('.image-card');
            const newOrder = Array.from(items).map(item => {
                const index = parseInt(item.getAttribute('data-index'));
                return selectedImages[index];
            });
            selectedImages = newOrder;
        }
    });
    
    // Event listeners
    selectImagesBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    dropArea.addEventListener('dragover', handleDragOver);
    dropArea.addEventListener('dragleave', handleDragLeave);
    dropArea.addEventListener('drop', handleDrop);
    convertBtn.addEventListener('click', convertToPdf);
    downloadBtn.addEventListener('click', downloadPdf);
    resetBtn.addEventListener('click', resetApp);
    marginInput.addEventListener('input', updateMarginValue);
    
    // Update margin value display
    function updateMarginValue() {
        marginValue.textContent = `${marginInput.value}mm`;
    }
    
    // Handle drag over
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.add('highlight');
    }
    
    // Handle drag leave
    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.remove('highlight');
    }
    
    // Handle drop
    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.remove('highlight');
        
        const files = e.dataTransfer.files;
        if (files.length) {
            processFiles(files);
        }
    }
    
    // Handle file select
    function handleFileSelect(e) {
        const files = e.target.files;
        if (files.length) {
            processFiles(files);
        }
    }
    
    // Process selected files
    function processFiles(files) {
        let validFiles = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if file is an image
            if (file.type.startsWith('image/')) {
                validFiles.push(file);
            } else {
                showToast(`Skipped ${file.name} - Not an image file`, 'error');
            }
        }
        
        if (validFiles.length > 0) {
            addImages(validFiles);
        } else {
            showToast('No valid image files selected', 'error');
        }
    }
    
    // Add images to the list
    function addImages(files) {
        files.forEach(file => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = new Image();
                img.src = e.target.result;
                
                img.onload = function() {
                    const imageData = {
                        file: file,
                        name: file.name,
                        size: formatFileSize(file.size),
                        src: e.target.result,
                        width: img.width,
                        height: img.height,
                        type: file.type
                    };
                    
                    selectedImages.push(imageData);
                    updateImageList();
                    
                    // Show options container after first image is added
                    if (selectedImages.length === 1) {
                        conversionContainer.style.display = 'block';
                        convertBtn.style.display = 'block';
                        resetBtn.style.display = 'block';
                        uploadContainer.style.display = 'none';
                    }
                };
            };
            
            reader.readAsDataURL(file);
        });
        
        showToast(`${files.length} image(s) added successfully`, 'success');
    }
    
    // Update the image list display
    function updateImageList() {
        imageList.innerHTML = '';
        
        selectedImages.forEach((image, index) => {
            const col = document.createElement('div');
            col.className = 'col';
            
            const card = document.createElement('div');
            card.className = 'image-card rounded-3 shadow-sm';
            card.setAttribute('data-index', index);
            
            card.innerHTML = `
                <button class="btn btn-sm btn-danger remove-btn" data-index="${index}"><i class="fas fa-x"></i></button>
                <img src="${image.src}" class="card-img-top rounded-3" alt="${image.name}" />
                <small class="image-list-title text-truncate rounded-bottom-3">${image.name}</small>
            `;
            
            col.appendChild(card);
            imageList.appendChild(col);
        });


        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removeImage(index);
            });
        });
        
        // Update image count
        imageCount.textContent = selectedImages.length;
        
        // Show/hide images container
        conversionContainer.style.display = selectedImages.length ? 'block' : 'none';
        
        // Hide options and convert button if no images
        if (selectedImages.length === 0) {
            conversionContainer.style.display = 'none';
            downloadBtn.style.display = 'none';
            resetBtn.style.display = 'none';

            uploadContainer.style.display = 'block';
        }
    }
    
    // Remove an image
    function removeImage(index) {
        selectedImages.splice(index, 1);
        updateImageList();
        showToast('Image removed', 'warning');
    }
    
    // Convert images to PDF with fixed positioning and scaling
    function convertToPdf() {
        if (selectedImages.length === 0) {
            showToast('No images to convert', 'error');
            return;
        }
        
        // Show progress bar
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        
        // Disable buttons during conversion
        convertBtn.disabled = true;
        resetBtn.disabled = true;
        
        // Get conversion options
        const orientation = document.getElementById('pageOrientation').value;
        const pageSize = document.getElementById('pageSize').value;
        const bgColor = document.getElementById('backgroundColor').value;
        const imagePosition = document.getElementById('imagePosition').value;
        const margin = parseInt(document.getElementById('margin').value);
        const pdfName = document.getElementById('pdfName').value || 'output.pdf';
        
        // Initialize PDF
        const { jsPDF } = window.jspdf;
        pdfDoc = new jsPDF();
        
        // Process images one by one with progress tracking
        let processed = 0;
        
        const processNextImage = () => {
            if (processed >= selectedImages.length) {
                // Conversion complete
                progressBar.style.width = '100%';
                progressPercent.textContent = '100%';
                
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    downloadBtn.style.display = 'inline-block';
                    convertBtn.disabled = false;
                    resetBtn.disabled = false;
                    showToast('PDF conversion complete!', 'success');
                }, 500);
                
                return;
            }
            
            const image = selectedImages[processed];
            const img = new Image();
            img.src = image.src;
            
            img.onload = function() {
                // Calculate dimensions based on options
                let pageWidth, pageHeight;
                
                // Set page size in millimeters
                if (pageSize === 'auto') {
                    // Convert image dimensions from pixels to mm (assuming 96 DPI)
                    const pxToMm = 25.4 / 96;
                    pageWidth = img.width * pxToMm;
                    pageHeight = img.height * pxToMm;
                    
                    // Ensure minimum size
                    pageWidth = Math.max(pageWidth, 10);
                    pageHeight = Math.max(pageHeight, 10);
                } else {
                    // Use standard page sizes in mm
                    switch (pageSize) {
                        case 'a4':
                            pageWidth = 210;
                            pageHeight = 297;
                            break;
                        case 'letter':
                            pageWidth = 215.9;
                            pageHeight = 279.4;
                            break;
                        case 'legal':
                            pageWidth = 215.9;
                            pageHeight = 355.6;
                            break;
                        case 'tabloid':
                            pageWidth = 279.4;
                            pageHeight = 431.8;
                            break;
                        default:
                            pageWidth = 210;
                            pageHeight = 297;
                    }
                    
                    // Adjust for orientation
                    if (orientation === 'landscape' || 
                        (orientation === 'auto' && img.width > img.height)) {
                        [pageWidth, pageHeight] = [pageHeight, pageWidth];
                    }
                }
                
                // Add new page (except for first image)
                if (processed > 0) {
                    pdfDoc.addPage([pageWidth, pageHeight], orientation === 'landscape' ? 'l' : 'p');
                } else {
                    pdfDoc = new jsPDF({
                        orientation: pageWidth > pageHeight ? 'l' : 'p',
                        unit: 'mm',
                        format: [pageWidth, pageHeight]
                    });
                }
                
                // Set background color
                if (bgColor !== '#ffffff') {
                    pdfDoc.setFillColor(bgColor);
                    pdfDoc.rect(0, 0, pageWidth, pageHeight, 'F');
                }
                
                // Calculate available content area (with margins)
                const contentWidth = pageWidth - (margin * 2);
                const contentHeight = pageHeight - (margin * 2);
                
                // Calculate image dimensions to fit content area while maintaining aspect ratio
                const imgRatio = img.width / img.height;
                const contentRatio = contentWidth / contentHeight;
                
                let imgWidth, imgHeight;
                
                if (imagePosition === 'stretch') {
                    // Stretch to exactly fit content area (may distort image)
                    imgWidth = contentWidth;
                    imgHeight = contentHeight;
                } else {
                    // Maintain aspect ratio
                    if (imgRatio > contentRatio) {
                        // Image is wider than content area
                        imgWidth = contentWidth;
                        imgHeight = contentWidth / imgRatio;
                    } else {
                        // Image is taller than content area
                        imgHeight = contentHeight;
                        imgWidth = contentHeight * imgRatio;
                    }
                }
                
                // Calculate image position based on selected option
                let imgX, imgY;
                
                switch (imagePosition) {
                    case 'center':
                        imgX = margin + (contentWidth - imgWidth) / 2;
                        imgY = margin + (contentHeight - imgHeight) / 2;
                        break;
                    case 'top-left':
                        imgX = margin;
                        imgY = margin;
                        break;
                    case 'top-right':
                        imgX = margin + contentWidth - imgWidth;
                        imgY = margin;
                        break;
                    case 'bottom-left':
                        imgX = margin;
                        imgY = margin + contentHeight - imgHeight;
                        break;
                    case 'bottom-right':
                        imgX = margin + contentWidth - imgWidth;
                        imgY = margin + contentHeight - imgHeight;
                        break;
                    case 'stretch':
                        imgX = margin;
                        imgY = margin;
                        break;
                    default: // center
                        imgX = margin + (contentWidth - imgWidth) / 2;
                        imgY = margin + (contentHeight - imgHeight) / 2;
                }
                
                // Add image to PDF (jsPDF handles mm to points conversion internally)
                pdfDoc.addImage({
                    imageData: img.src,
                    x: imgX,
                    y: imgY,
                    width: imgWidth,
                    height: imgHeight,
                    format: image.type.split('/')[1].toUpperCase()
                });
                
                // Update progress
                processed++;
                const progress = Math.round((processed / selectedImages.length) * 100);
                progressBar.style.width = `${progress}%`;
                progressPercent.textContent = `${progress}%`;
                
                // Process next image with slight delay to allow UI updates
                setTimeout(processNextImage, 100);
            };
            
            img.onerror = function() {
                showToast(`Failed to load image: ${image.name}`, 'error');
                processed++;
                const progress = Math.round((processed / selectedImages.length) * 100);
                progressBar.style.width = `${progress}%`;
                progressPercent.textContent = `${progress}%`;
                setTimeout(processNextImage, 100);
            };
        };
        
        // Start processing
        processNextImage();
    }
    
    // Download the PDF
    function downloadPdf() {
        if (!pdfDoc) {
            showToast('No PDF to download', 'error');
            return;
        }
        
        const pdfName = document.getElementById('pdfName').value || 'output.pdf';
        pdfDoc.save(pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`);
        showToast('PDF downloaded successfully', 'success');
    }
    
    // Reset the application
    function resetApp() {
        selectedImages = [];
        pdfDoc = null;
        fileInput.value = '';
        updateImageList();
        progressContainer.style.display = 'none';
        convertBtn.style.display = 'none';
        downloadBtn.style.display = 'none';
        uploadContainer.style.display = 'block';
        convertBtn.disabled = false;
        resetBtn.disabled = false;
        
        // Reset options to defaults
        document.getElementById('pageOrientation').value = 'portrait';
        document.getElementById('pageSize').value = 'a4';
        document.getElementById('backgroundColor').value = '#ffffff';
        document.getElementById('imagePosition').value = 'center';
        document.getElementById('margin').value = '10';
        document.getElementById('pdfName').value = '';
        updateMarginValue();
        
        showToast('Application reset', 'warning');
    }
    
    // Show toast notification
    function showToast(message, type) {
        const toastContainer = document.querySelector('.toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} show`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                <small>Just now</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'} me-2"></i>
                ${message}
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
        
        // Initialize Bootstrap toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }


});


// Initialize tooltips
document.addEventListener('DOMContentLoaded', function() {
    // Generate more floating icons dynamically
    const container = document.querySelector('.floating-icons');
    const icons = ['fa-file-pdf', 'fa-image', 'fa-cloud-upload-alt', 'fa-download', 'fa-file-alt', 'fa-photo-video'];
    
    for (let i = 0; i < 8; i++) {
        const icon = document.createElement('i');
        icon.className = `floating-icon fas ${icons[Math.floor(Math.random() * icons.length)]}`;
        icon.style.left = `${Math.random() * 90 + 5}%`;
        icon.style.top = `${Math.random() * 90 + 5}%`;
        icon.style.fontSize = `${Math.random() * 15 + 15}px`;
        icon.style.animationDelay = `${Math.random() * 10}s`;
        icon.style.animationDuration = `${Math.random() * 10 + 10}s`;
        container.appendChild(icon);
    }
});
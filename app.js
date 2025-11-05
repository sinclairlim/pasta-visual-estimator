// Pasta expansion data (volume expansion ratio when cooked) - Long pasta only
const PASTA_DATA = {
    'spaghetti': { name: 'Spaghetti', expansion: 2.5, density: 0.65, length: 10.0 },
    'angel-hair': { name: 'Angel Hair', expansion: 2.2, density: 0.60, length: 10.0 },
    'linguine': { name: 'Linguine', expansion: 2.4, density: 0.65, length: 10.0 },
    'fettuccine': { name: 'Fettuccine', expansion: 2.3, density: 0.70, length: 10.0 },
    'bucatini': { name: 'Bucatini', expansion: 2.4, density: 0.68, length: 10.0 }
};

// Standard spaghetti length in inches
const SPAGHETTI_LENGTH_INCHES = 10.0;

// App state
let appState = {
    pastaType: '',
    bowlDiameter: 8, // set by user with slider
    pastaAmount: 100, // calculated from bundle diameter
    unit: 'grams',
    spaghettiLineLength: 500, // pixels on canvas (very long by default)
    pastaBundleDiameter: 1.0, // inches - measured by user
    isLeftHanded: false // pasta reference position: false = left side (default), true = right side
};

// DOM Elements
const steps = document.querySelectorAll('.step');
const pastaTypeSelect = document.getElementById('pastaType');
const nextStep1Btn = document.getElementById('nextStep1');
const bowlSizeSlider = document.getElementById('bowlSize');
const bowlSizeDisplay = document.getElementById('bowlSizeDisplay');
const calibrationCanvas = document.getElementById('calibrationCanvas');
const cameraVideo = document.getElementById('cameraVideo');
const startCameraBtn = document.getElementById('startCamera');
const cameraStatus = document.getElementById('cameraStatus');
const nextStep2Btn = document.getElementById('nextStep2');
const nextStep3Btn = document.getElementById('nextStep3');
const pastaCanvas = document.getElementById('pastaCanvas');
const resultCanvas = document.getElementById('resultCanvas');
const startOverBtn = document.getElementById('startOver');

// Camera stream
let cameraStream = null;
let animationFrameId = null;

// Dragging state
let isDraggingLine = false;
let isDraggingPastaCircle = false;
let dragOffset = { x: 0, y: 0 };
let pastaAnimationFrameId = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupEventListeners();
    setupCalibrationCanvas();
}

function setupEventListeners() {
    // Step 1: Pasta type selection
    pastaTypeSelect.addEventListener('change', (e) => {
        appState.pastaType = e.target.value;
        nextStep1Btn.disabled = !e.target.value;
    });

    nextStep1Btn.addEventListener('click', () => goToStep(2));

    // Step 2: Camera and Bowl calibration
    startCameraBtn.addEventListener('click', startCamera);

    // Canvas interaction for dragging
    calibrationCanvas.addEventListener('mousedown', handleCanvasMouseDown);
    calibrationCanvas.addEventListener('mousemove', handleCanvasMouseMove);
    calibrationCanvas.addEventListener('mouseup', handleCanvasMouseUp);
    calibrationCanvas.addEventListener('touchstart', handleCanvasTouchStart);
    calibrationCanvas.addEventListener('touchmove', handleCanvasTouchMove);
    calibrationCanvas.addEventListener('touchend', handleCanvasTouchEnd);

    // Bowl size slider
    const bowlSizeSlider = document.getElementById('bowlSizeSlider');
    const bowlSizeValue = document.getElementById('bowlSizeValue');
    const bowlSizeDisplay2 = document.getElementById('bowlSizeDisplay2');

    if (bowlSizeSlider) {
        bowlSizeSlider.addEventListener('input', (e) => {
            appState.bowlDiameter = parseFloat(e.target.value);
            if (bowlSizeValue) bowlSizeValue.textContent = appState.bowlDiameter.toFixed(1);
            if (bowlSizeDisplay2) bowlSizeDisplay2.textContent = appState.bowlDiameter.toFixed(1);
        });
    }

    // Preset bowl size buttons
    document.querySelectorAll('.btn-preset-bowl').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const size = parseFloat(e.target.dataset.size);
            appState.bowlDiameter = size;
            if (bowlSizeSlider) bowlSizeSlider.value = size;
            if (bowlSizeValue) bowlSizeValue.textContent = size.toFixed(1);
            if (bowlSizeDisplay2) bowlSizeDisplay2.textContent = size.toFixed(1);
        });
    });

    nextStep2Btn.addEventListener('click', () => {
        goToStep(3);
        setupPastaCanvas();
        drawPastaOverlay();
    });

    // Step 3: Pasta bundle measurement
    if (pastaCanvas) {
        pastaCanvas.addEventListener('mousedown', handlePastaCanvasMouseDown);
        pastaCanvas.addEventListener('mousemove', handlePastaCanvasMouseMove);
        pastaCanvas.addEventListener('mouseup', handlePastaCanvasMouseUp);
        pastaCanvas.addEventListener('touchstart', handlePastaCanvasTouchStart);
        pastaCanvas.addEventListener('touchmove', handlePastaCanvasTouchMove);
        pastaCanvas.addEventListener('touchend', handlePastaCanvasTouchEnd);
    }

    // Pasta bundle slider
    const pastaBundleSlider = document.getElementById('pastaBundleSlider');
    const pastaBundleSliderValue = document.getElementById('pastaBundleSliderValue');

    if (pastaBundleSlider) {
        pastaBundleSlider.addEventListener('input', (e) => {
            appState.pastaBundleDiameter = parseFloat(e.target.value);
            if (pastaBundleSliderValue) pastaBundleSliderValue.textContent = appState.pastaBundleDiameter.toFixed(1);
        });
    }

    // Handedness toggle
    const handednessToggle = document.getElementById('handednessToggle');
    if (handednessToggle) {
        handednessToggle.addEventListener('change', (e) => {
            appState.isLeftHanded = e.target.checked;
            // Redraw will happen automatically via animation loop
        });
    }

    nextStep3Btn.addEventListener('click', () => {
        calculateAndShowEstimate();
        goToStep(4);
    });

    // Start over
    startOverBtn.addEventListener('click', () => {
        resetApp();
        goToStep(1);
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        setupCalibrationCanvas();
        drawCalibrationCircle();
        if (steps[3].classList.contains('active')) {
            drawResultVisualization();
        }
    });
}

function setupCalibrationCanvas() {
    // Set initial canvas size
    updateCalibrationCanvasSize();
}

function updateCalibrationCanvasSize() {
    if (cameraStream && cameraVideo.videoWidth > 0) {
        // Match video dimensions
        calibrationCanvas.width = cameraVideo.videoWidth;
        calibrationCanvas.height = cameraVideo.videoHeight;
    } else {
        // Default size when no camera
        const container = document.getElementById('cameraContainer');
        const size = Math.min(container.clientWidth, 400);
        calibrationCanvas.width = size;
        calibrationCanvas.height = size;
    }
}

async function startCamera() {
    try {
        cameraStatus.textContent = '📷 Starting camera...';

        // Request camera access with rear camera preference for mobile
        const constraints = {
            video: {
                facingMode: 'environment', // Use rear camera on mobile
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraVideo.srcObject = cameraStream;

        // Wait for video to be ready
        await new Promise((resolve) => {
            cameraVideo.onloadedmetadata = () => {
                resolve();
            };
        });

        cameraStatus.textContent = '✅ Camera active - adjust circle to match your bowl';
        cameraStatus.style.color = '#27ae60';
        startCameraBtn.style.display = 'none';

        // Update canvas size to match video
        updateCalibrationCanvasSize();

        // Start drawing overlay
        drawCameraOverlay();
    } catch (error) {
        console.error('Camera error:', error);
        cameraStatus.textContent = '❌ Camera access denied. Please enable camera permissions.';
        cameraStatus.style.color = '#e74c3c';
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function drawCameraOverlay() {
    const ctx = calibrationCanvas.getContext('2d');
    const centerX = calibrationCanvas.width / 2;
    const centerY = calibrationCanvas.height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, calibrationCanvas.width, calibrationCanvas.height);

    // Calculate pixels per inch from spaghetti reference
    const pixelsPerInch = appState.spaghettiLineLength / SPAGHETTI_LENGTH_INCHES;
    const bowlRadiusPixels = (appState.bowlDiameter / 2) * pixelsPerInch;

    // Draw bowl circle (BLUE) - behind spaghetti
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, bowlRadiusPixels, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw bowl label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(centerX - 60, centerY - 15, 120, 30);
    ctx.fillStyle = '#00aaff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`BOWL (${appState.bowlDiameter}")`, centerX, centerY);

    // Draw spaghetti reference line (GREEN) - on top
    const lineY = centerY;
    const lineStartX = centerX - appState.spaghettiLineLength / 2;
    const lineEndX = centerX + appState.spaghettiLineLength / 2;

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 8;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(lineStartX, lineY);
    ctx.lineTo(lineEndX, lineY);
    ctx.stroke();

    // Draw endpoints for easier grabbing
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(lineStartX, lineY, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lineEndX, lineY, 15, 0, Math.PI * 2);
    ctx.fill();

    // Label for spaghetti line
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(centerX - 80, lineY - 50, 160, 30);
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPAGHETTI (10")', centerX, lineY - 35);

    // Continue animation loop
    animationFrameId = requestAnimationFrame(drawCameraOverlay);
}


function getCanvasCoordinates(event) {
    const rect = calibrationCanvas.getBoundingClientRect();
    const scaleX = calibrationCanvas.width / rect.width;
    const scaleY = calibrationCanvas.height / rect.height;

    let clientX, clientY;
    if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function handleCanvasMouseDown(event) {
    if (!cameraStream) return;
    const coords = getCanvasCoordinates(event);
    checkDragStart(coords);
}

function handleCanvasTouchStart(event) {
    if (!cameraStream) return;
    event.preventDefault();
    const coords = getCanvasCoordinates(event);
    checkDragStart(coords);
}

function checkDragStart(coords) {
    const centerX = calibrationCanvas.width / 2;
    const centerY = calibrationCanvas.height / 2;
    const lineY = centerY;
    const lineStartX = centerX - appState.spaghettiLineLength / 2;
    const lineEndX = centerX + appState.spaghettiLineLength / 2;

    // Check if clicking on spaghetti line endpoints
    const distToStart = Math.hypot(coords.x - lineStartX, coords.y - lineY);
    const distToEnd = Math.hypot(coords.x - lineEndX, coords.y - lineY);

    if (distToStart < 30 || distToEnd < 30) {
        isDraggingLine = true;
        dragOffset.x = coords.x - centerX;
        return;
    }
}

function handleCanvasMouseMove(event) {
    if (!cameraStream) return;
    const coords = getCanvasCoordinates(event);
    handleDrag(coords);
}

function handleCanvasTouchMove(event) {
    if (!cameraStream) return;
    event.preventDefault();
    const coords = getCanvasCoordinates(event);
    handleDrag(coords);
}

function handleDrag(coords) {
    const centerX = calibrationCanvas.width / 2;

    if (isDraggingLine) {
        // Adjust line length based on horizontal distance from center
        const distFromCenter = Math.abs(coords.x - centerX);
        appState.spaghettiLineLength = Math.max(100, Math.min(calibrationCanvas.width * 0.95, distFromCenter * 2));
    }
}

function handleCanvasMouseUp() {
    isDraggingLine = false;
}

function handleCanvasTouchEnd() {
    isDraggingLine = false;
}

// Step 3: Pasta bundle measurement functions
function setupPastaCanvas() {
    if (!pastaCanvas || !cameraVideo) return;

    // Reuse the same camera stream
    const container = pastaCanvas.parentElement;
    const width = cameraVideo.videoWidth || container.clientWidth;
    const height = cameraVideo.videoHeight || container.clientHeight;

    pastaCanvas.width = width;
    pastaCanvas.height = height;
}

function drawPastaOverlay() {
    if (!pastaCanvas || !cameraStream) return;

    const ctx = pastaCanvas.getContext('2d');
    const centerX = pastaCanvas.width / 2;
    const centerY = pastaCanvas.height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, pastaCanvas.width, pastaCanvas.height);

    // Draw video frame manually
    ctx.drawImage(cameraVideo, 0, 0, pastaCanvas.width, pastaCanvas.height);

    // Calculate pixels per inch from spaghetti reference
    const pixelsPerInch = appState.spaghettiLineLength / SPAGHETTI_LENGTH_INCHES;
    const bowlRadiusPixels = (appState.bowlDiameter / 2) * pixelsPerInch;
    const pastaRadiusPixels = (appState.pastaBundleDiameter / 2) * pixelsPerInch;

    // Draw bowl circle (BLUE) - reference
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, bowlRadiusPixels, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate pasta circle position - positioned to the side of the bowl
    // Position it so the pasta circle is just inside the bowl edge for easy comparison
    const offsetFromBowlCenter = bowlRadiusPixels * 0.5; // Position at half radius from center
    const pastaCircleX = appState.isLeftHanded
        ? centerX + offsetFromBowlCenter  // Right side for left-handed
        : centerX - offsetFromBowlCenter; // Left side by default (for right-handers)
    const pastaCircleY = centerY;

    // Draw pasta bundle circle (ORANGE) - adjustable
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(pastaCircleX, pastaCircleY, pastaRadiusPixels, 0, Math.PI * 2);
    ctx.stroke();

    // Draw grab handle
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(pastaCircleX + pastaRadiusPixels, pastaCircleY, 15, 0, Math.PI * 2);
    ctx.fill();

    // Label for pasta bundle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(pastaCircleX - 70, pastaCircleY - 15, 140, 30);
    ctx.fillStyle = '#ff6600';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`PASTA (${appState.pastaBundleDiameter.toFixed(1)}")`, pastaCircleX, pastaCircleY);

    // Calculate and update pasta weight
    calculatePastaWeight();

    // Continue animation loop
    pastaAnimationFrameId = requestAnimationFrame(drawPastaOverlay);
}

function calculatePastaWeight() {
    // Calculate pasta weight from bundle diameter
    // Formula: weight ≈ π * (diameter/2)^2 * length * density
    // For spaghetti bundle, we use empirical approximation
    const pastaData = PASTA_DATA[appState.pastaType];
    const radiusInches = appState.pastaBundleDiameter / 2;
    const area = Math.PI * Math.pow(radiusInches, 2);

    // Approximate: 100g of spaghetti ≈ 1 inch diameter bundle
    // This is a rough estimate based on typical pasta packing density
    const gramsPerSquareInch = 32; // Empirical constant for long pasta
    const estimatedGrams = area * gramsPerSquareInch;

    appState.pastaAmount = Math.round(estimatedGrams);

    // Update displays
    const pastaBundleSize = document.getElementById('pastaBundleSize');
    const pastaWeight = document.getElementById('pastaWeight');

    if (pastaBundleSize) pastaBundleSize.textContent = appState.pastaBundleDiameter.toFixed(1);
    if (pastaWeight) pastaWeight.textContent = appState.pastaAmount;
}

function handlePastaCanvasMouseDown(event) {
    if (!cameraStream) return;
    const coords = getPastaCanvasCoordinates(event);
    checkPastaDragStart(coords);
}

function handlePastaCanvasTouchStart(event) {
    if (!cameraStream) return;
    event.preventDefault();
    const coords = getPastaCanvasCoordinates(event);
    checkPastaDragStart(coords);
}

function checkPastaDragStart(coords) {
    const centerX = pastaCanvas.width / 2;
    const centerY = pastaCanvas.height / 2;
    const pixelsPerInch = appState.spaghettiLineLength / SPAGHETTI_LENGTH_INCHES;
    const bowlRadiusPixels = (appState.bowlDiameter / 2) * pixelsPerInch;
    const pastaRadiusPixels = (appState.pastaBundleDiameter / 2) * pixelsPerInch;

    // Calculate pasta circle position - positioned to the side of the bowl
    const offsetFromBowlCenter = bowlRadiusPixels * 0.5;
    const pastaCircleX = appState.isLeftHanded
        ? centerX + offsetFromBowlCenter  // Right side for left-handed
        : centerX - offsetFromBowlCenter; // Left side by default
    const pastaCircleY = centerY;

    // Check if clicking on pasta circle edge
    const distToCenter = Math.hypot(coords.x - pastaCircleX, coords.y - pastaCircleY);
    const distToEdge = Math.abs(distToCenter - pastaRadiusPixels);

    if (distToEdge < 30 || distToCenter < pastaRadiusPixels) {
        isDraggingPastaCircle = true;
        return;
    }
}

function handlePastaCanvasMouseMove(event) {
    if (!cameraStream) return;
    const coords = getPastaCanvasCoordinates(event);
    handlePastaDrag(coords);
}

function handlePastaCanvasTouchMove(event) {
    if (!cameraStream) return;
    event.preventDefault();
    const coords = getPastaCanvasCoordinates(event);
    handlePastaDrag(coords);
}

function handlePastaDrag(coords) {
    const centerX = pastaCanvas.width / 2;
    const centerY = pastaCanvas.height / 2;
    const pixelsPerInch = appState.spaghettiLineLength / SPAGHETTI_LENGTH_INCHES;
    const bowlRadiusPixels = (appState.bowlDiameter / 2) * pixelsPerInch;

    // Calculate pasta circle position - positioned to the side of the bowl
    const offsetFromBowlCenter = bowlRadiusPixels * 0.5;
    const pastaCircleX = appState.isLeftHanded
        ? centerX + offsetFromBowlCenter  // Right side for left-handed
        : centerX - offsetFromBowlCenter; // Left side by default
    const pastaCircleY = centerY;

    if (isDraggingPastaCircle) {
        // Adjust pasta bundle diameter based on distance from pasta circle center
        const distToCenter = Math.hypot(coords.x - pastaCircleX, coords.y - pastaCircleY);
        const diameterInches = (distToCenter * 2) / pixelsPerInch;
        appState.pastaBundleDiameter = Math.max(0.25, Math.min(6, diameterInches));

        // Update slider to match dragged value
        const pastaBundleSlider = document.getElementById('pastaBundleSlider');
        const pastaBundleSliderValue = document.getElementById('pastaBundleSliderValue');
        if (pastaBundleSlider) pastaBundleSlider.value = appState.pastaBundleDiameter;
        if (pastaBundleSliderValue) pastaBundleSliderValue.textContent = appState.pastaBundleDiameter.toFixed(1);
    }
}

function handlePastaCanvasMouseUp() {
    isDraggingPastaCircle = false;
}

function handlePastaCanvasTouchEnd() {
    isDraggingPastaCircle = false;
}

function getPastaCanvasCoordinates(event) {
    const rect = pastaCanvas.getBoundingClientRect();
    const scaleX = pastaCanvas.width / rect.width;
    const scaleY = pastaCanvas.height / rect.height;

    let clientX, clientY;
    if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function drawCalibrationCircle() {
    // This function is now only used when camera is not active
    if (cameraStream) {
        return; // Don't draw static circle if camera is running
    }

    const ctx = calibrationCanvas.getContext('2d');
    const centerX = calibrationCanvas.width / 2;
    const centerY = calibrationCanvas.height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, calibrationCanvas.width, calibrationCanvas.height);

    // Calculate circle radius based on bowl diameter
    const maxRadius = (calibrationCanvas.width * 0.8) / 2;
    const radius = (appState.bowlDiameter / 14) * maxRadius;

    // Draw background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, calibrationCanvas.width, calibrationCanvas.height);

    // Draw grid for reference
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    for (let i = 0; i < calibrationCanvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, calibrationCanvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(calibrationCanvas.width, i);
        ctx.stroke();
    }

    // Draw bowl circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw crosshairs
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();

    // Draw measurement label
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${appState.bowlDiameter}"`, centerX, centerY);
}

function calculateAndShowEstimate() {
    const pastaData = PASTA_DATA[appState.pastaType];

    // Convert to grams if needed
    let gramsAmount = appState.pastaAmount;
    if (appState.unit === 'ounces') {
        gramsAmount = appState.pastaAmount * 28.35;
    }

    // Calculate cooked amount
    const cookedGrams = gramsAmount * pastaData.expansion;

    // Calculate bowl volume (simplified as cylinder)
    const bowlRadiusInches = appState.bowlDiameter / 2;
    const bowlDepthInches = bowlRadiusInches * 0.6; // Typical bowl depth ratio
    const bowlVolumeCubicInches = Math.PI * Math.pow(bowlRadiusInches, 2) * bowlDepthInches;

    // Estimate pasta volume (considering density)
    const pastaVolumeCubicInches = (cookedGrams / pastaData.density) / 16.387; // Convert from cm³ to in³

    // Calculate raw fill percentage
    const rawFillPercentage = (pastaVolumeCubicInches / bowlVolumeCubicInches) * 100;

    // Apply visual buffer - cooked pasta has gaps/spaces between strands
    // Visual fill appears about 1.5x-1.8x higher than actual volume due to pasta packing
    // This makes the estimate match what you actually see in the bowl
    const visualMultiplier = 1.6; // Empirically adjusted for realistic visual perception
    const fillPercentage = Math.min(100, rawFillPercentage * visualMultiplier);

    // Update display
    document.getElementById('displayPastaType').textContent = pastaData.name;
    document.getElementById('displayBowlSize').textContent = appState.bowlDiameter;
    document.getElementById('displayRawAmount').textContent = `${appState.pastaAmount} ${appState.unit}`;

    const cookedDisplay = appState.unit === 'grams'
        ? `${cookedGrams.toFixed(0)} grams`
        : `${(cookedGrams / 28.35).toFixed(1)} ounces`;
    document.getElementById('displayCookedAmount').textContent = cookedDisplay;
    document.getElementById('displayExpansion').textContent =
        `This pasta expands ${pastaData.expansion}x when cooked`;

    document.getElementById('fillLevel').textContent = fillPercentage.toFixed(0);
    document.getElementById('fillBarInner').style.width = `${fillPercentage}%`;

    // Store for visualization
    appState.fillPercentage = fillPercentage;

    drawResultVisualization();
}

function drawResultVisualization() {
    const container = resultCanvas.parentElement;
    const size = Math.min(container.clientWidth - 40, 400);
    resultCanvas.width = size;
    resultCanvas.height = size * 0.8; // Make it wider than tall for side view

    const ctx = resultCanvas.getContext('2d');

    // Bowl dimensions (side view)
    const bowlWidth = resultCanvas.width * 0.7;
    const bowlHeight = resultCanvas.height * 0.6;
    const bowlCenterX = resultCanvas.width / 2;
    const bowlBottom = resultCanvas.height * 0.85;
    const bowlTop = bowlBottom - bowlHeight;

    // Clear canvas
    ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

    // Draw bowl (side view - cross section)
    ctx.beginPath();
    ctx.moveTo(bowlCenterX - bowlWidth/2, bowlTop + 20); // Left rim

    // Left curve (bowl side)
    ctx.quadraticCurveTo(
        bowlCenterX - bowlWidth/2 + 20, bowlBottom - bowlHeight/2,
        bowlCenterX - bowlWidth/3, bowlBottom - 10
    );

    // Bottom curve
    ctx.quadraticCurveTo(
        bowlCenterX, bowlBottom,
        bowlCenterX + bowlWidth/3, bowlBottom - 10
    );

    // Right curve (bowl side)
    ctx.quadraticCurveTo(
        bowlCenterX + bowlWidth/2 - 20, bowlBottom - bowlHeight/2,
        bowlCenterX + bowlWidth/2, bowlTop + 20
    );

    // Top rim line
    ctx.lineTo(bowlCenterX - bowlWidth/2, bowlTop + 20);

    ctx.fillStyle = '#f8f9fa';
    ctx.fill();
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Calculate pasta fill height
    const fillHeight = (bowlHeight - 30) * (appState.fillPercentage / 100);
    const pastaTop = bowlBottom - 10 - fillHeight;

    if (fillHeight > 0) {
        // Draw pasta fill with gradient
        const gradient = ctx.createLinearGradient(0, pastaTop, 0, bowlBottom);
        gradient.addColorStop(0, '#f4d03f');
        gradient.addColorStop(0.5, '#f39c12');
        gradient.addColorStop(1, '#e67e22');

        ctx.beginPath();

        // Calculate width at fill level (narrower at bottom)
        const fillRatio = fillHeight / (bowlHeight - 30);
        const pastaWidth = (bowlWidth * 0.6) + (bowlWidth * 0.2 * fillRatio);

        // Draw pasta surface (wavy top)
        ctx.moveTo(bowlCenterX - pastaWidth/2, pastaTop);

        // Wavy pasta surface
        const waves = 5;
        for (let i = 0; i <= waves; i++) {
            const x = bowlCenterX - pastaWidth/2 + (pastaWidth * i / waves);
            const waveHeight = Math.sin(i * Math.PI / 2) * 5;
            ctx.lineTo(x, pastaTop + waveHeight);
        }

        // Right side of pasta
        ctx.lineTo(bowlCenterX + pastaWidth/2, pastaTop);
        ctx.quadraticCurveTo(
            bowlCenterX + pastaWidth/2 + 10, bowlBottom - bowlHeight/3,
            bowlCenterX + bowlWidth/3, bowlBottom - 10
        );

        // Bottom curve
        ctx.quadraticCurveTo(
            bowlCenterX, bowlBottom,
            bowlCenterX - bowlWidth/3, bowlBottom - 10
        );

        // Left side of pasta
        ctx.quadraticCurveTo(
            bowlCenterX - pastaWidth/2 - 10, bowlBottom - bowlHeight/3,
            bowlCenterX - pastaWidth/2, pastaTop
        );

        ctx.fillStyle = gradient;
        ctx.fill();

        // Add pasta strand texture
        const isLongPasta = ['spaghetti', 'angel-hair', 'linguine', 'fettuccine', 'bucatini'].includes(appState.pastaType);

        if (isLongPasta && fillHeight > 20) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 25; i++) {
                const y = pastaTop + 10 + Math.random() * (fillHeight - 20);
                const xStart = bowlCenterX - pastaWidth/3 + Math.random() * 20;
                const xEnd = bowlCenterX + pastaWidth/3 - Math.random() * 20;
                const curve = (Math.random() - 0.5) * 20;

                ctx.beginPath();
                ctx.moveTo(xStart, y);
                ctx.quadraticCurveTo(bowlCenterX + curve, y + (Math.random() - 0.5) * 10, xEnd, y);
                ctx.stroke();
            }
        }
    }

    // Draw fill percentage text
    if (appState.fillPercentage > 0) {
        const textY = bowlTop - 30;
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${appState.fillPercentage.toFixed(0)}% Full`, bowlCenterX, textY);
    }

    // Warning if overfilled
    if (appState.fillPercentage > 90) {
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ Bowl may overflow!', bowlCenterX, bowlTop - 60);
    }
}

function goToStep(stepNumber) {
    // Stop camera when leaving steps 2 and 3
    if (stepNumber !== 2 && stepNumber !== 3) {
        stopCamera();
    }

    // Stop pasta animation when leaving step 3
    if (stepNumber !== 3 && pastaAnimationFrameId) {
        cancelAnimationFrame(pastaAnimationFrameId);
        pastaAnimationFrameId = null;
    }

    steps.forEach((step, index) => {
        step.classList.remove('active');
        if (index === stepNumber - 1) {
            step.classList.add('active');
        }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetApp() {
    stopCamera();

    // Stop pasta animation if running
    if (pastaAnimationFrameId) {
        cancelAnimationFrame(pastaAnimationFrameId);
        pastaAnimationFrameId = null;
    }

    appState = {
        pastaType: '',
        bowlDiameter: 8,
        pastaAmount: 100,
        unit: 'grams',
        spaghettiLineLength: 500,
        pastaBundleDiameter: 1.0,
        isLeftHanded: false
    };

    pastaTypeSelect.value = '';
    nextStep1Btn.disabled = true;

    const bowlSizeSlider = document.getElementById('bowlSizeSlider');
    const bowlSizeValue = document.getElementById('bowlSizeValue');
    const bowlSizeDisplay2 = document.getElementById('bowlSizeDisplay2');
    const pastaBundleSlider = document.getElementById('pastaBundleSlider');
    const pastaBundleSliderValue = document.getElementById('pastaBundleSliderValue');
    const handednessToggle = document.getElementById('handednessToggle');

    if (bowlSizeSlider) bowlSizeSlider.value = 8;
    if (bowlSizeValue) bowlSizeValue.textContent = '8.0';
    if (bowlSizeDisplay2) bowlSizeDisplay2.textContent = '8.0';
    if (pastaBundleSlider) pastaBundleSlider.value = 1.0;
    if (pastaBundleSliderValue) pastaBundleSliderValue.textContent = '1.0';
    if (handednessToggle) handednessToggle.checked = false;

    // Reset camera UI
    startCameraBtn.style.display = 'block';
    cameraStatus.textContent = 'Click "Start Camera" to begin';
    cameraStatus.style.color = '';
}

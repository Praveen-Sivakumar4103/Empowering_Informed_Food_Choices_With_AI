/*Signed by Iniya Vasanthan V M (v.m.iniyavasanthan@email.com), Vishal S, Praveen S | GPG Signature verified*/
// camera.js - Updated with proper cleanup
const cameraView = document.getElementById('cameraView');
const captureBtn = document.getElementById('captureBtn');
const resultCanvas = document.getElementById('resultCanvas');
let stream = null;

// Start camera when page loads
window.addEventListener('DOMContentLoaded', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        cameraView.srcObject = stream;
        window.addEventListener('resize', adjustVideoSize);
        adjustVideoSize();
    } catch (err) {
        console.error("Camera error: ", err);
        alert("Could not access the camera. Please check permissions.");
        window.close();
    }
});

function adjustVideoSize() {
    const container = document.getElementById('cameraContainer');
    const aspectRatio = 4/3;
    if (window.innerHeight > window.innerWidth) {
        container.style.width = '90vw';
        container.style.height = `${90 * aspectRatio}vw`;
    } else {
        container.style.width = '70vh';
        container.style.height = `${70 * aspectRatio}vh`;
    }
}

// Capture image
captureBtn.addEventListener('click', () => {
    const width = cameraView.videoWidth;
    const height = cameraView.videoHeight;
    resultCanvas.width = width;
    resultCanvas.height = height;
    
    const context = resultCanvas.getContext('2d');
    context.drawImage(cameraView, 0, 0, width, height);
    
    resultCanvas.toBlob(blob => {
        const file = new File([blob], 'captured-image.png', { type: 'image/png' });
        try {
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ image: file }, '*');
            } else {
                alert('The main window was closed. Please try again.');
            }
            // Clean up before closing
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            window.close();
        } catch (e) {
            console.error('Error sending image:', e);
            alert('Error sending image to main window. Please try again.');
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            window.close();
        }
    }, 'image/png', 0.95);
});

// Clean up camera stream when window closes
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
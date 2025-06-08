// Get the button element
const button = document.getElementById('gradientButton');

// Function to normalize gyroscope values from -90 to 90 (common gyro range) to 0 to 1
function normalize(value) {
    // Assuming gyroscope values range from -90 to 90 degrees
    return (value + 90) / 180;
}

// Function to update the gradient based on gyroscope values
function updateGradient(x, y, z) {
    // Normalize the gyroscope values to 0-1 range
    const normX = normalize(x); // Controls first color (Red)
    const normY = normalize(y); // Controls second color (Green)
    const normZ = normalize(z); // Controls third color (Blue)

    // Map normalized values to RGB values (0-255)
    // We're multiplying the normalized values to affect color stops and intensity
    const red = Math.floor(normX * 255);
    const green = Math.floor(normY * 255);
    const blue = Math.floor(normZ * 255);

    // Update the button's background gradient using the normalized values
    button.style.background = `linear-gradient(45deg, 
        rgb(${red}, ${255 - red}, ${blue / 2}), 
        rgb(${235}, ${green}, ${186}), 
        rgb(${153}, ${255 - blue}, ${255}))`;

    const grey1 = Math.floor(100 + normX * 80); 
    const grey2 = Math.floor(150 + normY * 40); 
    const grey3 = Math.floor(130 + normZ * 60); 

    button.style.borderImage = `linear-gradient(${normY * 120}deg, 
        rgb(${grey1},${grey1},${grey1}) 0%, 
        rgb(${grey2},${grey2},${grey2}) 50%, 
        rgb(${grey3},${grey3},${grey3}) 100%) 1`;
}

// Handle gyroscope data
function handleOrientation(event) {
    // Get gyroscope data (beta, gamma, alpha)
    let x = event.beta;  // X-axis rotation (-180 to 180)
    let y = event.gamma; // Y-axis rotation (-90 to 90)
    let z = event.alpha; // Z-axis rotation (0 to 360)

    // Limit ranges if necessary (optional, depends on device)
    x = Math.max(-90, Math.min(90, x));
    y = Math.max(-90, Math.min(90, y));
    z = Math.max(0, Math.min(360, z));

    // Update the gradient based on gyro data
    updateGradient(x, y, z);
}

// Request permission for gyroscope access (iOS 13+ requires this)
async function requestPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation, true);
            } else {
                alert('Permission denied for gyroscope access.');
            }
        } catch (error) {
            console.error('Error requesting gyroscope permission:', error);
            alert('Could not access gyroscope.');
        }
    } else {
        // Non-iOS or older browsers, just add the event listener
        window.addEventListener('deviceorientation', handleOrientation, true);
    }
}

// Initialize the app
function init() {
    // Check if gyroscope is supported
    if (window.DeviceOrientationEvent) {
        requestPermission();
    } else {
        alert('Sorry, your device does not support gyroscope.');
    }
}

// Start the application when the page loads
window.onload = init;

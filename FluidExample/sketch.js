let gyroX = 0;
let gyroY = 0;

function setupGyroControls() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    const button = createButton('Enable Gyro Control');
    button.position(20, 20);
    button.style('font-size', '18px');
    button.mousePressed(async () => {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleGyro, true);
        }
      } catch (error) {
        console.error(error);
      }
      button.remove();
    });
  } else {
    window.addEventListener('deviceorientation', handleGyro, true);
  }
}

function handleGyro(event) {
  gyroX = map(event.gamma, -90, 90, 0, width);
  gyroY = map(event.beta, -180, 180, 0, height);
}

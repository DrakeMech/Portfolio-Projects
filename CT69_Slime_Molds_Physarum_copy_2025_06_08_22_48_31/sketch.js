/*
----- Coding Tutorial by Patt Vira ----- 
Name: Slime Molds (Physarum)
Video Tutorial: https://youtu.be/VyXxSNcgDtg

References: 
1. Algorithm by Jeff Jones: https://uwe-repository.worktribe.com/output/980579/characteristics-of-pattern-formation-and-evolution-in-approximations-of-physarum-transport-networks

Connect with Patt: @pattvira
https://www.pattvira.com/
----------------------------------------
*/

let molds = [];
let num = 1000;
let d;

let gyroX = 0;
let gyroY = 0;
let gyroButton; // Add this at the top

// Request permission and listen for device orientation
function setup() {
  pixelDensity(0.8); // Add this for lower-res rendering
  createCanvas(window.innerWidth, window.innerHeight);
  angleMode(DEGREES);
  d = pixelDensity();

  // Create the gyro access button for iOS
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    gyroButton = createButton('Enable Gyro Control');
    gyroButton.position(20, 20);
    gyroButton.style('font-size', '18px');
    gyroButton.mousePressed(requestGyroAccess);
  } else {
    // Non-iOS devices
    window.addEventListener('deviceorientation', handleGyro);
  }

  for (let i=0; i<num; i++) {
    molds[i] = new Mold();
  } 
}



function handleGyro(event) {
  // event.beta: front-back tilt [-180,180], event.gamma: left-right tilt [-90,90]
  gyroX = map(event.gamma, -90, 90, 0, width);
  gyroY = map(event.beta, -180, 180, 0, height);
}

let frameSkip = 2;
function draw() {
  background(2, 10);
  if (frameCount % frameSkip === 0) loadPixels();
  loadPixels();

  for (let i = 0; i < num; i++) {
    if (key == "s") {
      // If "s" key is pressed, molds stop moving
      molds[i].stop = true;
      if (frameCount % frameSkip === 0) loadPixels();
      updatePixels();
      noLoop();
    } else {
      molds[i].stop = false;
    }
    
    // Make each mold head toward the cursor
    molds[i].updateHeadingTowardsCursor();

    molds[i].update();
    molds[i].display();
  }
}

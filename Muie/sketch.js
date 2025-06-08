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

let molds = []; let num = 200;
let d; 

function updateSensorDist() {
    // Map mouseY to a range, for example, 10 to 100
    let newDist = map(mouseY, 0, height, 1, 360);
    console.log(newDist)
    for (let i = 0; i < molds.length; i++) {
      molds[i].sensorAngle = newDist;
    }
  }
  

  function keyPressed() {
    if (key === 'u') {  // Press 'u' to increase sensor distance
      updateSensorDist(500);  // Set to a new distance value, e.g., 50
    } else if (key === 'd') {  // Press 'd' to decrease sensor distance
      updateSensorDist(10);  // Set to a different distance value, e.g., 20
    }
  }

let gyroX = 0;
let gyroY = 0;

// Request permission and listen for device orientation
function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  angleMode(DEGREES);
  d = pixelDensity();

  // Request permission for iOS 13+ devices
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleGyro);
        }
      })
      .catch(console.error);
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

function draw() {
    background(0, 5);
    loadPixels();
  
    // Update sensorDist based on mouseY
    // updateSensorDist();
  
    for (let i = 0; i < num; i++) {
      if (key == "s") {
        molds[i].stop = true;
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

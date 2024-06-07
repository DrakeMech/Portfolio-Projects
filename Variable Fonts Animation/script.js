/*
 * Assignment 3: Functional Prototype
 * ----------------------------------
 * Programming 2023, Interaction Design Bacherlor, Malmö University
 * 
 * This assignment is written by:
 * Cristache Stefan
 * 
 * 
 * This assignment represents Ecstasy, the urge feeling of temporary joy for a limited time, that excites you till it fades away. The more
 * you get excited, the longer it takes. But it's never a permanent relief, just a temporary emotion that we feel from a reaction of our brains based on the results of our action.
 * 
 * This project itself is based on the user typing letters that will start the excitementand gets more intesified whenever you type more because the setTime is stacking
 * This method might be not be the best , but i guess it does what it intends to do. I am sorry that i've went back and forth with the emotions
 * because it was hard to go around making the heartbeat functions and other functions that would make that project possible. The time constrain
 * really .
 * 
 * Another thing i should mention is that whenever the user types the font starts the descenders and ascenders starts to bop.
 */


import { Easings } from "https://unpkg.com/ixfx/dist/modulation.js";

// The state contains all the "moving" parts of the program, values that change over time.
let state = Object.freeze({
    lowerCaseH: 480,
    upperCaseH: 730,
    thinStroke: 77,
    excitement: false,
    ascenderH: 750,
    descenderH: -203,
});

// The settings object contains all the "fixed" parts of the sketch, like static HTMLElements, parameters, or thresholds.
const settings = Object.freeze({
    textElement: document.querySelector("#text"), // A static HTMLElement representing the text area
    keys: [], // An array to store the keys pressed by the user
    easing: Easings.time('arch', 400), // Easing function for smooth transitions
    easingBop: Easings.time('arch', 200), // Another easing function for bop effects
    ignoreKeys: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift", "Control", "CapsLock", "Meta", "Escape", "Enter", "Alt", "Tab", "Spacebar", "Backspace"], // An array of keys to ignore during user input
    keyLength: 10,
});


function updateState(newState) {
    state = Object.freeze({ ...state, ...newState });
}

// Function to scale a number from a given range to a normalized 0..1 range.
function scale(num, min, max) {
    if (num < min) return 0;
    if (num > max) return 1;
    return (num - min) / (max - min);
}

// Function to transform a normalized 0..1 value back to the original range.
function toAbsolute(num, min, max) {
    if (num < 0) return min;
    if (num > 1) return max;
    return (num * (max - min)) + min;
}

// Function to handle the dancing effect based on easing.
function danceFn() {
    const { easing } = settings;
    let easedValue;
    // easedValue is initiated and then is computing the values between 0-1 withing the easing function that is stated in settings
    easedValue = easing.compute();
    // all 3 values called here are equal to the normalized value from 0 and 1 threshold of a min and maximum 
    const newLowerCaseH = toAbsolute(easedValue, 360, 500);
    const newUpperCaseH = toAbsolute(easedValue, 579, 740);
    const newThinStroke = toAbsolute(easedValue, 75, 40);

    if (easedValue === 0)
        easing.reset(); // Reset the easing function when the animation is complete

    // Update the state with the new values
    updateState({
        lowerCaseH: newLowerCaseH,
        upperCaseH: newUpperCaseH,
        thinStroke: newThinStroke,
    });
}

// Function to handle the bop effect based on another easing function.
function bopFn() {
    const { easingBop } = settings;
    const easedValue = easingBop.compute();
    //does the same thing but different values from the 
    const newAscenderH = toAbsolute(easedValue, 750, 854);
    const newDescenderH = toAbsolute(easedValue, -203, -270);

    // Update the state with the new value
    updateState({
        ascenderH: newAscenderH,
        descenderH: newDescenderH,
    });
}

// The main loop that updates the interface every frame.
function loop() {
    const { keys, excitement, lowerCaseH, thinStroke, upperCaseH, ascenderH, descenderH } = state;
    const { textElement } = settings;
    updateState({ keys, excitement });
    //here is the condition which checks whenever the excitement in true and false inside the state
    if (excitement) {
        danceFn(); // Apply the dancing effect if excitement is true
        //Adds the active class into the body and text element
        textElement.classList.add("active");
        document.body.classList.add('active');
    } else {
        //Removes the active class into the body and text element
        textElement.classList.remove("active");
        document.body.classList.remove('active');
    }

    bopFn(); // Apply the bop effect
    //The textElement font variation here and updates into the loop 
    textElement.style = `font-variation-settings: 'YTLC' ${lowerCaseH}, 'YTUC' ${upperCaseH}, 'YOPQ' ${thinStroke}, 'YTAS' ${ascenderH}, 'YTDE' ${descenderH};`;
    window.requestAnimationFrame(loop); // Request to run the loop function on the next frame
}

// Setup function that initializes the program
function setup() {
    const { textElement, keys, easingBop, ignoreKeys, keyLength } = settings;
    let positions = {}; //This is the position object later for the positions of the elements in textElement

    // Event listener for keydown events
    document.addEventListener("keydown", function (event) {
        if (keys.length <= keyLength) {
            if (event.code === 'Space')
                return;
            switch (event.key) {
                default: {
                    if (ignoreKeys.includes(event.key)) return; // Ignore specific keys from the input
                    easingBop.reset(); // Reset the bop easing function
                    updateState({ excitement: true }); // Set excitement to true
                    updateState({ keys: keys.push(event.key) }); // Push the pressed key into the keys array
                }
            }
        }

        // Generate random positions for each character and apply the typing effect and creates span element inside the textElement
        keys.forEach((key, index) => {
            if (!positions.hasOwnProperty(index)) {
                //here it inserts into the values inside the positions object for each index of the keys that are going to be inserted 
                positions[index] = {
                    left: Math.random() * window.innerWidth,// Here it generates random value for the left
                    top: Math.random() * window.innerHeight,// Here it generates random value for the top 
                };
            }
            const span = document.createElement('span'); // This created the span element and initiate it as a constant element
            span.textContent = key; // Here the key inside the keys Array is inserted inside the span that was created
            span.style.position = 'absolute'; // The span position is set as Absolute so it is being affected by other span elements 
            //This part is setting the position of the span that was created from the positions object of that index 
            span.style.left = positions[index].left + 'px';
            span.style.top = positions[index].top + 'px';
            textElement.appendChild(span);//This line is the one that actually inserts the created span inside the textElement
        });
        console.log({ positions });
        // It selects all span elements from the text element and is initiated in allSpans
        const allSpans = textElement.querySelectorAll('span');
        //This method is taking all span elements using forEach method and calls a function using it as a parameter
        allSpans.forEach(span => {
            //calling a delayed function
            setTimeout(() => {
                span.style.transition = 'opacity 1s';
                span.style.opacity = 0;
                //The delayed function is called and it removes the span element and removes the last key from the array
                setTimeout(() => {
                    span.remove();
                    keys.pop();
                    positions = {};
                }, 1000);
            }, 2000);
        });

    });

    // Event listener for keyup events to reset the excitement state
    document.addEventListener("keyup", function (event) {
        // Set the excitement back to false after 4 seconds
        setTimeout(() => {
            updateState({ excitement: false })
        }, 2000);
    });

    loop();
}

setup(); // Call the setup function to initialize the program

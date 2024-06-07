// The state should contain all the "moving" parts of your program, values that change.
let state = Object.freeze({
    pointerEvent: { x: 0, y: 0 },
    sample: {
        element: document.querySelector("#sample-output"),
    },
    backgroundColorPage: document.body.style,
    pulseEl: document.getElementById("pulse-output"),
    textDescription: document.getElementById("textEl"),
})


// The settings should contain all of the "fixed" parts of your programs, like static HTMLElements and paramaters.
const settings = Object.freeze({
    sample: {
        height: 100,
        width: 100,
        element: document.querySelector("#sample-output"),
    },
});


/**
 * Update the state object with the properties included in `newState`.
 * @param {Object} newState An object with the properties to update in the state object.
 */
function updateState(newState) {
    state = Object.freeze({ ...state, ...newState });
}


/**
 * Return `num` normalized to 0..1 in range min..max.
 * @param {number} num
 * @param {number} min 
 * @param {number} max 
 * @returns number
 */
function scale(num, min, max) {
    if (num < min) return 0;
    if (num > max) return 1;
    return (num - min) / (max - min);
}

/**
 * Return `num` transformed from the normalised 0..1 form back to the min..max form.
 * @param {number} num
 * @param {number} min 
 * @param {number} max 
 * @returns number
 */
function toAbsolute(num, min, max) {
    if (num < 0) return min;
    if (num > 1) return max;
    return (num * (max - min)) + min;
}

/**
 * This is where we put the code that transforms and outputs our data.
 * loop() is run every frame, assuming that we keep calling it with `window.requestAnimationFrame`.
 */
function loop() {
    const { pointerEvent } = state;
    const { sample } = settings;
    const currentSize = parseInt(sample.element.style.height);
    const { backgroundColorPage } = state;

    const mirroredPoint = {
        x: scale(pointerEvent.x, 0, window.innerWidth),
        y: scale(pointerEvent.y, 0, window.innerHeight),
    }

    const absolutePoint = {
        x: toAbsolute(mirroredPoint.x, 0, window.innerWidth) - (sample.width / 2),
        y: toAbsolute(mirroredPoint.y, 0, window.innerHeight) - (sample.height / 2),
    }
    sample.element.style.transform = `translate(${absolutePoint.x}px, ${absolutePoint.y}px)`;
    //This is the function that calls the function deflate()
    deflate();
    //this is checking whenever the size of the circle is in between 200px and 800px so that would go to the main background 
    if (currentSize > 200 && currentSize < 800) {
        backgroundColorPage.transition = `2s`;
        backgroundColorPage.backgroundColor = `hsla(30, 81%, 72%, 0)`;
        updateState({ backgroundColorPage });
    }

    window.requestAnimationFrame(loop);
}


//this is the deflate function that decrements the size by 5 whenever the size of the circle (sample) height is bigger the 100px  
function deflate() {
    const deflateValue = 5;
    const { sample } = state;
    if (parseInt(sample.element.style.height) > 100) {
        const oldSize = parseInt(sample.element.style.height);
        const newSize = oldSize - deflateValue;
        sample.element.style.height = `${newSize}px`;
        sample.element.style.width = `${newSize}px`;
    }

}
/*this is the deflate function that increments the size on random values (0. - 19.) and shifts 
the background color when it reaches over 800px height on the element
*/
function inflate() {
    const { sample } = state;
    const currentSize = parseInt(sample.element.style.height);
    const { backgroundColorPage } = state;
    if (currentSize > 800) {
        backgroundColorPage.transition = `2s`;
        backgroundColorPage.backgroundColor = `hsla(30, 81%, 72%, 1)`;
        updateState({ backgroundColorPage });
    }
    const inflateValue = Math.floor(Math.random() * 20);
    const oldSize = parseInt(sample.element.style.height);
    const newSize = inflateValue + oldSize;
    sample.element.style.height = `${newSize}px`;
    sample.element.style.width = `${newSize}px`;

}



/**
 * Setup is run once, at the start of the program. It sets everything up for us!
 */
function setup() {
    const { sample } = settings;
    const { backgroundColorPage } = state;
    const { textDescription } = state;
    const { pulseEl } = state;
    sample.element.style.height = `${sample.height}px`;
    sample.element.style.width = `${sample.width}px`;
    /*debounce function is  a setTimeout function which is set based on the function that is used as a parameter and a delay that was given, 
    the if function is checking if the function reached the intended delay for it to it to stop */
    const debounce = (fn, delay) => {
        let timeoutID;
        return function (...args) {
            if (timeoutID) {
                clearTimeout(timeoutID);
            }
            timeoutID = setTimeout(() => {
                fn(...args);
            }, delay);
        };
    };
    //this changeContrast is used to remove the pulse animation and change the background and element color to the first state of the page
    function changeContrast() {

        const { sample } = state;
        sample.element.style.backgroundColor = `hsla(30, 81%, 72%, 1)`;
        backgroundColorPage.transition = `1s`;
        backgroundColorPage.backgroundColor = `hsla(0, 0%, 0%, 0)`;
        pulseEl.classList.remove('active');
        updateState({ backgroundColorPage });
    }
    //this pointer is adding a function where is checking each time if the height of the element is smaller or equals the 100 then is changing the text context and value and the background too
    document.addEventListener("pointerdown", function () {
        if (parseInt(sample.element.style.height) <= 100) {
            sample.element.style.backgroundColor = "hsla(30, 81%, 72%, 0)"
            pulseEl.classList.add('active');
            textDescription.textContent = `Luminosity`;
            textDescription.style.color = `hsl(0, 0%, 100%)`;
            backgroundColorPage.transition = `1s`;
            backgroundColorPage.backgroundColor = `rgb(6, 7, 14)`;
            updateState({ backgroundColorPage });
        }
    });
    //this pointer is changing the content of the text and color by letting the pointer up , while using the changeContrast function 
    document.addEventListener("pointerup", debounce(() => {
        textDescription.textContent = `Inflatability`;
        textDescription.style.color = `hsl(0, 0%, 0%)`;
        changeContrast();
    }, 400));
    //this pointer is changing the the size of the object, with the movement
    document.addEventListener("pointermove", function (event) {
        updateState({ pointerEvent: event });
        const currentSize = parseInt(sample.element.style.height);

        if (currentSize < 1000 && backgroundColorPage.backgroundColor != `rgb(6, 7, 14)`) {
            inflate();
        }

        //this is the function which updates the color of the pulse based on the x coordonate 
        function updatePulse(e) {
            let x = e.clientX / window.innerWidth * 360;
            let color = `hsl(${x}, 81%, 72%)`;
            document.documentElement.style.setProperty('--pulse-background', color);
        }
        //updatePulse is called
        updatePulse(event);

    });
    //this is calling out the loop function for the frames
    loop();
}


setup(); // Always remember to call setup()!

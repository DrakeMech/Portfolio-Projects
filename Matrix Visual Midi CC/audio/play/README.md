# play

Demonstrates playing and stopping a sample.

Add samples via the HTML:
```html
<audio src="./kick.mp3" id="kick"></audio>
```

You can then trigger it:
```js
const { audio } = settings;
// Get the wrapper
const a = audio.get(`kick`);
// Call 'play' on the AUDIO element
a.el.play();
```

Use `pause` to stop.

See the `filter` and `stereo-pan` demos for working with the audio graph.
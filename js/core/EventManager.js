/**
 * @file Manager handling the keyboard and mouse/touch events.
 * 
 * @author Alain Pitiot
 * @version 3.0.0b11
 * @copyright (c) 2018 Ilixa Ltd. ({@link http://ilixa.com})
 * @license Distributed under the terms of the MIT License
 */

import { MonotonicClock, Clock } from '../util/Clock';
import { PsychoJS } from './PsychoJS';
import * as util from '../util/Util';


/**
 * @class
 * <p>This manager handles all participant interactions with the experiment, i.e. keyboard, mouse and touch events.</p>
 * 
 * @name module:core.EventManager
 * @class
 * @param {Object} options
 * @param {PsychoJS} options.psychoJS - the PsychoJS instance
 */
export class EventManager {

	constructor(psychoJS) {
		this._psychoJS = psychoJS;

		// populate the reverse pyglet map:
		for (var keyName in EventManager._pygletMap)
			EventManager._reversePygletMap[EventManager._pygletMap[keyName]] = keyName;

		// add key listeners:
		this._keyBuffer = [];
		this._addKeyListeners();

		// mouse info:
		// note: (a) clocks are reset on mouse button presses
		//       (b) the mouse listeners are added to the PIXI renderer, upon the latter's creation (see  Window.js)
		this._mouseInfo = {
			pos: [0, 0],
			wheelRel: [0.0, 0.0],
			buttons: {
				pressed: [0, 0, 0],
				clocks: [new Clock(), new Clock(), new Clock()],
				// time elapsed from last reset of the button.Clocks:
				times: [0.0, 0.0, 0.0]
			},
			// clock reset when mouse is moved:
			moveClock: new Clock()
		};
	}


	/**
	 * Get the list of keys pressed by the participant.
	 * 
	 * <p>Note: The w3c [key-event viewer]{@link https://w3c.github.io/uievents/tools/key-event-viewer.html} can be used to see possible values for the items in the keyList given the user's keyboard and chosen layout. The "key" and "code" columns in the UI Events fields are the relevant values for the keyList argument.</p>
	 * 
	 * @name module:core.EventManager#getKeys
	 * @function
	 * @public
	 * @param {Object} options
	 * @param {Array.string} [options.keyList= null] - keyList allows the user to specify a set of keys to check for. Only keypresses from this set of keys will be removed from the keyboard buffer. If no keyList is given, all keys will be checked and the key buffer will be cleared completely.
	 * @param {boolean} [options.timeStamped= false] - If true will return a list of tuples instead of a list of keynames. Each tuple has (keyname, time).
	 * @return {Array.string} the list of keys that were pressed.
	 */
	getKeys({
		keyList = null,
		timeStamped = false
	} = {}) {
		if (keyList != null)
			keyList = this._pyglet2w3c(keyList);

		let newBuffer = [];
		let keys = [];
		for (let i = 0; i < this._keyBuffer.length; ++i) {
			const key = this._keyBuffer[i];
			let keyId = null;

			if (keyList != null) {
				let index = keyList.indexOf(key.code);
				if (index < 0)
					index = keyList.indexOf(EventManager._keycodeMap[key.keyCode]);
				if (index >= 0)
					keyId = EventManager._reversePygletMap[keyList[index]];
			}
			else
				keyId = EventManager._reversePygletMap[key.code];

			if (keyId != null) {
				if (timeStamped)
					keys.push([keyId, key.timestamp]);
				else
					keys.push(keyId);
			}
			else
				newBuffer.push(key); // keep key press in buffer
		}

		this._keyBuffer = newBuffer;
		return keys;
	}


	/**
	 * @typedef EventManager.ButtonInfo
	 * @property {Array.number} pressed - the status of each mouse button [left, center, right]: 1 for pressed, 0 for released
	 * @property {Array.Clock} clocks - the clocks associated to the mouse buttons, reset whenever the button is pressed
	 * @property {Array.number} times - the time elapsed since the last rest of the associated clock
	 */
	/**
	 * @typedef EventManager.MouseInfo
	 * @property {Array.number} pos - the position of the mouse [x, y]
	 * @property {Array.number} wheelRel - the relative position of the wheel [x, y]
	 * @property {EventManager.ButtonInfo} buttons - the mouse button info
	 * @property {Clock} moveClock - the clock that is reset whenever the mouse moves
	 */
	/**
	 * Get the mouse info.
	 * 
	 * @name module:core.EventManager#getMouseInfo
	 * @function
	 * @public
	 * @return {EventManager.MouseInfo} the mouse info.
	 */
	getMouseInfo() {
		return this._mouseInfo;
	}
	

	/**
	 * Clear all events from the event buffer.
	 * 
	 * @name module:core.EventManager#clearEvents
	 * @function
	 * @public
	 * 
	 * @todo handle the attribs argument
	 */
	clearEvents(attribs) {
		this.clearKeys();
	}


	/**
	 * Clear all keys from the key buffer.
	 * 
	 * @name module:core.EventManager#clearKeys
	 * @function
	 * @public
	 */
	clearKeys() {
		this._keyBuffer = [];
	}


	/**
	 * Start the move clock.
	 * 
	 * @name module:core.EventManager#startMoveClock
	 * @function
	 * @public
	 * 
	 * @todo not implemented
	 */
	startMoveClock() {
	}


	/**
	 * Stop the move clock.
	 * 
	 * @name module:core.EventManager#stopMoveClock
	 * @function
	 * @public
	 * 
	 * @todo not implemented
	 */
	stopMoveClock() {
	}


	/**
	 * Reset the move clock.
	 * 
	 * @name module:core.EventManager#resetMoveClock
	 * @function
	 * @public
	 * 
	 * @todo not implemented
	 */
	resetMoveClock() {
	}


	/**
	 * Add various mouse listeners to the Pixi renderer of the {@link Window}.
	 * 
	 * @name module:core.EventManager#addMouseListeners
	 * @function
	 * @public
	 * @param {PIXI.Renderer} renderer - The Pixi renderer
	 */
	addMouseListeners(renderer) {
		let self = this;

		const view = renderer.view;

		view.addEventListener("pointerdown", event => {
			self._mouseInfo.buttons.pressed[event.button] = 1;
			self._mouseInfo.buttons.times[event.button] = self._psychoJS._monotonicClock.getTime() - self._mouseInfo.buttons.clocks[event.button].getLastResetTime();

			self._mouseInfo.pos = [event.offsetX, event.offsetY];

			//psychoJS.logging.data("Mouse: " + label + " button down, pos=(" + x + "," + y + ")");
		}, false);

		view.addEventListener("pointerup", event => {
			self._mouseInfo.buttons.pressed[event.button] = 0;
			self._mouseInfo.buttons.times[event.button] = self._psychoJS._monotonicClock.getTime() - self._mouseInfo.buttons.clocks[event.button].getLastResetTime();
			self._mouseInfo.pos = [event.offsetX, event.offsetY];

			//psychoJS.logging.data("Mouse: " + label + " button down, pos=(" + x + "," + y + ")");
		}, false);

		view.addEventListener("pointermove", event => {
			self._mouseInfo.pos = [event.offsetX, event.offsetY];
			self._mouseInfo.moveClock.reset();
		}, false);

		view.addEventListener("wheel", event => {
			self._mouseInfo.wheelRel[0] += event.deltaX;
			self._mouseInfo.wheelRel[1] += event.deltaY;
			/*
			var x = ev.offsetX;
			var y = ev.offsetY;
				var msg = "Mouse: wheel shift=(" + ev.deltaX + "," + ev.deltaY + "), pos=(" + x + "," + y + ")";
				psychoJS.logging.data(msg);*/
		}, false);
	}


	/**
	 * Add key listeners to the document.
	 * 
	 * @name module:core.EventManager#_addKeyListeners
	 * @function
	 * @private
	 */
	_addKeyListeners() {
		let self = this;

		// add a keydown listener:
		document.addEventListener("keydown", (e) => {
			self._keyBuffer.push({
				code: e.code,
				key: e.key,
				keyCode: e.keyCode,
				timestamp: MonotonicClock.getReferenceTime() / 1000
			});
			self._psychoJS.logger.trace('keys pressed : ', util.toString(self._keyBuffer));
		});
	}



	/**
	 * Convert a keylist that uses pyglet key names to one that uses W3C KeyboardEvent.code values.
	 * <p>This allows key lists that work in the builder environment to work in psychoJS web experiments.</p>
	 * 
	 * @name module:core.EventManager#_pyglet2w3c
	 * @function
	 * @private
	 * @param {Array.string} keyList - the array of pyglet key names
	 * @return {Array.string} the w3c keyList
	 */
	_pyglet2w3c(pygletKeyList) {
		let w3cKeyList = [];
		for (let i = 0; i < pygletKeyList.length; i++) {
			if (typeof EventManager._pygletMap[pygletKeyList[i]] === 'undefined')
				w3cKeyList.push(pygletKeyList[i]);
			else
				w3cKeyList.push(EventManager._pygletMap[pygletKeyList[i]]);
		}

		return w3cKeyList;
	}
}


/**
 * <p>This map provides support for browsers that have not yet
 * adopted the W3C KeyboardEvent.code standard for detecting key presses.
 * It maps the deprecated KeyboardEvent.keycode values to the W3C UI event codes.</p>
 * 
 * @name module:core.EventManager#_keycodeMap
 * @readonly
 * @private
 * @type {Object.<number,String>}
 */
EventManager._keycodeMap = {
	49: "Digit1",
	50: "Digit2",
	51: "Digit3",
	52: "Digit4",
	53: "Digit5",
	54: "Digit6",
	55: "Digit7",
	56: "Digit8",
	57: "Digit9",
	48: "Digit0",
	65: "KeyA",
	66: "KeyB",
	67: "KeyC",
	68: "KeyD",
	69: "KeyE",
	70: "KeyF",
	71: "KeyG",
	72: "KeyH",
	73: "KeyI",
	74: "KeyJ",
	75: "KeyK",
	76: "KeyL",
	77: "KeyM",
	78: "KeyN",
	79: "KeyO",
	80: "KeyP",
	81: "KeyQ",
	82: "KeyR",
	83: "KeyS",
	84: "KeyT",
	85: "KeyU",
	86: "KeyV",
	87: "KeyW",
	88: "KeyX",
	89: "KeyY",
	90: "KeyZ",
	188: "Comma",
	190: "Period",
	186: "Semicolon",
	222: "Quote",
	219: "BracketLeft",
	221: "BracketRight",
	192: "Backquote",
	220: "Backslash",
	189: "Minus",
	187: "Equal",
	144: "NumLock",
	96: "Numpad0",
	97: "Numpad1",
	98: "Numpad2",
	99: "Numpad3",
	100: "Numpad4",
	101: "Numpad5",
	102: "Numpad6",
	103: "Numpad7",
	104: "Numpad8",
	105: "Numpad9",
	107: "NumpadAdd",
	194: "NumpadComma",
	194: "NumpadComma",
	110: "NumpadDecimal",
	110: "NumpadDecimal",
	111: "NumpadDivide",
	13: "NumpadEnter",
	12: "NumpadEqual",
	106: "NumpadMultiply",
	109: "NumpadSubtract",
	37: "ArrowLeft",
	38: "ArrowUp",
	39: "ArrowRight",
	40: "ArrowDown",
	27: "Escape",
	32: "Space"
};


/**
 * <p>This map associates pyglet key names to the corresponding W3C KeyboardEvent.codes.
 * 
 * @name module:core.EventManager#_pygletMap
 * @readonly
 * @private
 * @type {Object.<String,String>}
 */
EventManager._pygletMap = {
	// writing system keys
	"grave": "Backquote",
	"backslash": "Backslash",
	"backspace": "Backspace",
	"bracketleft": "BracketLeft",
	"bracketright": "BracketRight",
	"comma": "Comma",
	"0": "Digit0",
	"1": "Digit1",
	"2": "Digit2",
	"3": "Digit3",
	"4": "Digit4",
	"5": "Digit5",
	"6": "Digit6",
	"7": "Digit7",
	"8": "Digit8",
	"9": "Digit9",
	"equal": "Equal",
	"a": "KeyA",
	"b": "KeyB",
	"c": "KeyC",
	"d": "KeyD",
	"e": "KeyE",
	"f": "KeyF",
	"g": "KeyG",
	"h": "KeyH",
	"i": "KeyI",
	"j": "KeyJ",
	"k": "KeyK",
	"l": "KeyL",
	"m": "KeyM",
	"n": "KeyN",
	"o": "KeyO",
	"p": "KeyP",
	"q": "KeyQ",
	"r": "KeyR",
	"s": "KeyS",
	"t": "KeyT",
	"u": "KeyU",
	"v": "KeyV",
	"w": "KeyW",
	"x": "KeyX",
	"y": "KeyY",
	"z": "KeyZ",
	"minus": "Minus",
	"period": "Period",
	"apostrophe": "Quote",
	"semicolon": "Semicolon",
	"slash": "Slash",

	// functional keys
	"escape": "Escape",
	"loption": "AltLeft",
	"roption": "AltRight",
	"capslock": "CapsLock",
	"lcontrol": "ControlLeft",
	"rcontrol": "ControlRight",
	"return": "Enter",
	"lcommand": "MetaLeft",
	"rcommand": "MetaRight",
	"lshift": "ShiftLeft",
	"rshift": "ShiftRight",
	"space": "Space",
	"tab": "Tab",

	// arrowpad
	"down": "ArrowDown",
	"left": "ArrowLeft",
	"right": "ArrowRight",
	"up": "ArrowUp",

	// numeric pad
	"num_0": "Numpad0",
	"num_1": "Numpad1",
	"num_2": "Numpad2",
	"num_3": "Numpad3",
	"num_4": "Numpad4",
	"num_5": "Numpad5",
	"num_6": "Numpad6",
	"num_7": "Numpad7",
	"num_8": "Numpad8",
	"num_9": "Numpad9",
	"num_decimal": "NumpadDecimal",
	"num_enter": "NumpadEnter",
	"num_add": "NumpadAdd",
	"num_subtract": "NumpadSubtract",
	"num_multiply": "NumpadMultiply",
	"num_divide": "NumpadDivide",
	"num_equal": "NumpadEqual",
	"num_numlock": "NumpadNumlock"
};


/**
 * <p>This map associates W3C KeyboardEvent.codes to the corresponding pyglet key names.
 * 
 * @name module:core.EventManager#_reversePygletMap
 * @readonly
 * @private 
 * @type {Object.<String,String>}
 */
EventManager._reversePygletMap = {};


/**
 * @class
 * Utility class used by the experiment scripts to keep track of a clock and of the current status (whether or not we are currently checking the keyboard)
 * 
 * @name module:core.BuilderKeyResponse
 * @class
 * @param {Object} options
 * @param {PsychoJS} options.psychoJS - the PsychoJS instance
 */
export class BuilderKeyResponse {
	constructor(psychoJS) {
		this._psychoJS = psychoJS;

		this.status = PsychoJS.Status.NOT_STARTED;
		this.keys = []; // the key(s) pressed
		this.corr = 0;  // was the resp correct this trial? (0=no, 1=yes)
		this.rt = [];  // response time(s)
		this.clock = new Clock(); // we'll use this to measure the rt
	}
}
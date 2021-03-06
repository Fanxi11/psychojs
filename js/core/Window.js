/**
 * @file Window responsible for displaying the experiment stimuli
 * 
 * @author Alain Pitiot
 * @version 3.0.0b11
 * @copyright (c) 2018 Ilixa Ltd. ({@link http://ilixa.com})
 * @license Distributed under the terms of the MIT License
 */

import { Color } from '../util/Color';
import { PsychObject } from '../util/PsychObject';
import { MonotonicClock } from '../util/Clock';
import * as util from '../util/Util';

/**
 * <p>Window displays the various stimuli of the experiment.</p>
 * <p>It sets up a [PIXI]{@link http://www.pixijs.com/} renderer, which we use to render the experiment stimuli.</p>
 * 
 * @name module:core.Window
 * @class
 * @param {Object} options
 * @param {PsychoJS} options.psychoJS - the PsychoJS instance
 * @param {string} [options.name] the name of the window
 * @param {boolean} [options.fullscr= false] whether or not to go fullscreen
 * @param {Color} [options.color= Color('black')] the background color of the window
 * @param {string} [options.units= 'pix'] the units of the window
 * @param {boolean} [options.autoLog= true] whether or not to log
 * 
 * @extends PsychObject
 */
export class Window extends PsychObject {

	/**
	 * Getter for monitorFramePeriod.
	 * 
	 * @name module:core.Window#monitorFramePeriod
	 * @function
	 * @public
	 */
	get monitorFramePeriod() { return this._monitorFramePeriod; }

	constructor({
		psychoJS,
		name,
		fullscr = false,
		color = new Color('black'),
		units = 'pix',
		autoLog = true
	} = {}) {
		super(psychoJS, name);

		// messages to be logged at the next "flip":
		this._msgToBeLogged = [];

		// list of all elements, in the order they are currently drawn:
		this._drawList = [];

		this._addAttributes(Window, name, fullscr, color, units, autoLog);
		this._addAttribute('size', []);


		// setup PIXI:
		this._setupPixi();

		// monitor frame period:
		this._monitorFramePeriod = 1.0 / this.getActualFrameRate();

		this._frameCount = 0;

		this._flipCallback = undefined;
		this._flipCallbackArgs = undefined;

		/*if (autoLog)
			logging.exp("Created %s = %s" % (self.name, str(self)));*/
	}


	/**
	 * Close the window.
	 * 
	 * <p> Note: this actually only removes the canvas used to render the experiment stimuli.</p>
	 * 
	 * @name module:core.Window#close
	 * @function
	 * @public
	 */
	close() {
		if (document.body.contains(this._renderer.view))
			document.body.removeChild(this._renderer.view);

		window.removeEventListener('resize', this._resizeCallback);
		window.removeEventListener('orientationchange', this._resizeCallback);
	}


	/**
	 * Estimate the frame rate.
	 * 
	 * @name module:core.Window#getActualFrameRate
	 * @function
	 * @public
	 * @return {number} always returns 60.0 at the moment
	 * 
	 * @todo estimate the actual frame rate.
	 */
	getActualFrameRate() {
		// TODO
		return 60.0;
	}


	/**
	 * Take the browser full screen if possible.
	 * 
	 * @name module:core.Window#adjustScreenSize
	 * @function
	 * @public
	 */
	adjustScreenSize() {
		if (this.fullscr) {
			if (typeof document.documentElement.requestFullscreen === 'function')
				document.documentElement.requestFullscreen();
			else if (typeof document.documentElement.mozRequestFullScreen === 'function')
				document.documentElement.mozRequestFullScreen();
			else if (typeof document.documentElement.webkitRequestFullscreen === 'function')
				document.documentElement.webkitRequestFullscreen();
			else if (typeof document.documentElement.msRequestFullscreen === 'function')
				document.documentElement.msRequestFullscreen();
			else
				this.psychoJS.logger.warn('Unable to go fullscreen.');

			// the Window and all of the stimuli need updating:
			this._needUpdate = true;
			for (const stim of this._drawList)
				stim._needUpdate = true;
		}
	}


	/**
	 * Log a message.
	 * 
	 * <p> Note: the message will be time-stamped at the next call to requestAnimationFrame.</p>
	 * 
	 * @name module:core.Window#logOnFlip
	 * @function
	 * @public
	 * @param {Object} options
	 * @param {String} options.msg the message to be logged
	 * @param {integer} level the log level
	 * @param {Object} [obj] the object associated with the message
	 */
	logOnFlip({
		msg,
		level,
		obj = undefined } = {}) {
		this._msgToBeLogged.push({ msg, level, obj });
	}


	/**
	 * Specify the callback function ran after each screen flip, i.e. immedicately after each rendering of the Window.
	 * 
	 * <p>This is typically used to reset a timer or clock.</p>
	 * 
	 * @name module:core.Window#callOnFlip
	 * @function
	 * @public
	 * @param {*} flipFunction - callback function.
	 * @param {Object} flipArgs - arguments for the callback function.
	 */
	callOnFlip(flipCallback, ...flipCallbackArgs) {
		this._flipCallback = flipCallback;
		this._flipCallbackArgs = flipCallbackArgs;
	}


	/**
	 * Render the stimuli onto the canvas.
	 * 
	 * @name module:core.Window#render
	 * @function
	 * @public
	 */
	render() {
		this._frameCount++;

		// render the PIXI container:
		this._renderer.render(this._rootContainer);

		// this is to make sure that the GPU is done rendering, it may not be necessary
		// [http://www.html5gamedevs.com/topic/27849-detect-when-view-has-been-rendered/]
		this._renderer.gl.readPixels(0, 0, 1, 1, this._renderer.gl.RGBA, this._renderer.gl.UNSIGNED_BYTE, new Uint8Array(4));

		// log and call on flip:
		this._writeLogOnFlip();
		if (typeof this._flipCallback !== 'undefined')
			this._flipCallback(...this._flipCallbackArgs);

		// prepare the scene for the next animation frame:
		this._refresh();
	}


	/**
	 * Update this window, if need be.
	 * 
	 * @name module:core.Window#_updateIfNeeded
	 * @function
	 * @private
	 */
	_updateIfNeeded() {
		if (this._needUpdate) {
			this._renderer.backgroundColor = this._color.int;

			this._needUpdate = false;
		}
	}


	/**
	 * Recompute the window's _drawList and _container children for the next animation frame.
	 * 
	 * @name module:core.Window#_refresh
	 * @function
	 * @private
	 */
	_refresh() {
		this._updateIfNeeded();

		// if a stimuli needs to be updated, we remove it from the window container, update it, then put it back
		for (const stim of this._drawList)
			if (stim._needUpdate) {
				this._rootContainer.removeChild(stim._pixi);
				stim._updateIfNeeded();
				this._rootContainer.addChild(stim._pixi);
			}
	}


	/**
	 * Setup PIXI.
	 * 
	 * <p>A new renderer is created and a container is added to it. The renderer's touch and mouse events are handled by the {@link EventManager}.</p>
	 * 
	 * @name module:core.Window#_setupPixi
	 * @function
	 * @private
	 */
	_setupPixi() {
		// the size of the PsychoJS Window is always that of the browser
		this._size[0] = window.innerWidth;
		this._size[1] = window.innerHeight;

		// create a PIXI renderer and add it to the document:
		this._renderer = PIXI.autoDetectRenderer(this._size[0], this._size[1], {
			backgroundColor: this.color.int
		});
		this._renderer.view.style["transform"] = "translatez(0)";
		this._renderer.view.style.position = "absolute";
		document.body.appendChild(this._renderer.view);

		// top-level container:
		this._rootContainer = new PIXI.Container();

		// set size of renderer and position of root container:
		this._onResize(this);

		// touch/mouse events should be treated by PsychoJS' event manager:
		this.psychoJS.eventManager.addMouseListeners(this._renderer);

		// update the renderer size when the browser's size or orientation changes:
		this._resizeCallback = e => this._onResize(this);
		window.addEventListener('resize', this._resizeCallback);
		window.addEventListener('orientationchange', this._resizeCallback);
	}


	/**
	 * Treat a window resize event.
	 * 
	 * <p>We adjust the size of the renderer and the position of the root container.</p>
	 * <p>Note: since this method will be called by the DOM window (i.e. 'this' is
	 * the DOM window), we need to pass it a {@link Window}.</p>
	 * 
	 * @name module:core.Window#_onResize
	 * @function
	 * @private
	 * @param {Window} win - The PsychoJS window
	 */
	_onResize(win) {
		// update the size of the PsychoJS Window:
		win._size[0] = window.innerWidth;
		win._size[1] = window.innerHeight;

		win._renderer.view.style.width = win._size[0] + 'px';
		win._renderer.view.style.height = win._size[1] + 'px';
		win._renderer.view.style.left = '0px';
		win._renderer.view.style.top = '0px';
		win._renderer.resize(win._size[0], win._size[1]);

		// setup the container such that (0,0) is at the centre of the window
		// with positive coordinates to the right and top:
		win._rootContainer.position.x = win._size[0] / 2.0;
		win._rootContainer.position.y = win._size[1] / 2.0;
		win._rootContainer.scale.y = -1;
	}


	/**
	 * Send all logged messages to the {@link Logger}.
	 * 
	 * @name module:core.Window#_writeLogOnFlip
	 * @function
	 * @private
	 */
	_writeLogOnFlip() {
		var logTime = MonotonicClock.getReferenceTime();
		for (var i = 0; i < this._msgToBeLogged.length; ++i) {
			var entry = this._msgToBeLogged[i];
			this._psychoJS.logger.log(entry.msg, entry.level, logTime, entry.obj);
		}

		this._msgToBeLogged = [];
	}

}

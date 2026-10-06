// Entry point.
import { App } from './app.js';

const app = new App();
app.init();

// Handy for poking around in the browser console: try `planetApp.planet`.
window.planetApp = app;

import Oblecto from '../lib/oblecto/index.js';
import config from '../config.js';

const core = {
    oblecto: new Oblecto(config),

    start(): void {
        // The Oblecto instance is already initialized in the constructor
        // No additional initialization needed as the REST API and other components
        // are already set up in the Oblecto constructor
    },

    close(): void {
        this.oblecto.close();
    },
};

export default core;

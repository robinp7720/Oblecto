import Oblecto from '../lib/oblecto/index.js';
import config from '../config';

export default {
    oblecto: new Oblecto(config),

    start() {
        // The Oblecto instance is already initialized in the constructor
        // No additional initialization needed as the REST API and other components
        // are already set up in the Oblecto constructor
        console.log('Oblecto started successfully');
    },

    close() {
        this.oblecto.close();
    },
};

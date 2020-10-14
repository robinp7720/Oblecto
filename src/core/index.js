import Oblecto from '../lib/oblecto';
import config from '../config';


export default {
    oblecto: new Oblecto(config),

    start() {

    },

    close() {
        this.oblecto.close();
    },
};

import Oblecto from '../lib/oblecto';
import config from '../config';


export default {
    oblecto: null,

    start() {
        this.oblecto = new Oblecto(config);
    }
};

import Seedbox from './Seedbox';

export default class SeedboxController {
    constructor() {
        this.seedBoxes = [];
    }

    addSeedbox(seedboxConfig) {
        this.seedBoxes.push(new Seedbox(seedboxConfig));
    }
}

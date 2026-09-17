import { cp, mkdir } from 'fs/promises';
import { resolve } from 'path';

const source = resolve('jellyfin-web/dist');
const destination = resolve('dist/jellyfin-web');

await mkdir(resolve('dist'), { recursive: true });
await cp(source, destination, { recursive: true, force: true });

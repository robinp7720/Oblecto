/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import expect from 'expect.js';
import FileUpdater from '../../src/lib/updaters/files/FileUpdater.js';

describe('FileUpdater', function () {
    
    // Mock classes/objects
    class MockQueue {
        constructor() {
            this.jobs = {};
            this.queued = [];
        }
        registerJob(name, func) {
            this.jobs[name] = func;
        }
        queueJob(name, data) {
            this.queued.push({ name, data });
        }
        lowPriorityJob(name, data) {
            this.queued.push({
                name, data, priority: 'low' 
            });
        }
    }

    const mockOblecto = {
        queue: new MockQueue(),
        config: { files: { doHash: false } }
    };

    it('should queue indexFileStreams if stream count is 0', async function () {
        const updater = new FileUpdater(mockOblecto);
        
        const mockFile = {
            id: 1,
            path: '/path/to/video.mkv',
            duration: 100, // Valid duration
            size: 1000,
            extension: 'mkv',
            countStreams: async () => 0, // No streams!
            update: async () => {},
            hash: 'somehash'
        };

        await updater.updateFile(mockFile);

        // Check if indexFileStreams was queued
        const indexJob = mockOblecto.queue.queued.find(j => j.name === 'indexFileStreams');

        expect(indexJob).to.be.ok();
        expect(indexJob.data).to.be(mockFile);
    });

    it('should NOT queue indexFileStreams if stream count is > 0', async function () {
        // Reset queue
        mockOblecto.queue.queued = [];
        const updater = new FileUpdater(mockOblecto);
        
        const mockFile = {
            id: 1,
            path: '/path/to/video.mkv',
            duration: 100, // Valid duration
            size: 1000,
            extension: 'mkv',
            countStreams: async () => 2, // Has streams
            update: async () => {},
            hash: 'somehash'
        };

        await updater.updateFile(mockFile);

        // Check if indexFileStreams was queued
        const indexJob = mockOblecto.queue.queued.find(j => j.name === 'indexFileStreams');

        expect(indexJob).to.not.be.ok();
    });
});

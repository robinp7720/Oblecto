import assert from 'node:assert/strict';
import { describeMissingTools, probeTools } from '../../src/lib/oblecto/tools.js';
import type { IConfig } from '../../src/interfaces/config.js';

describe('External tool probe', () => {
    it('reports a configured binary that does not exist as missing', () => {
        const report = probeTools({ ffmpeg: { pathFFmpeg: '/nonexistent/ffmpeg', pathFFprobe: '/nonexistent/ffprobe' } } as IConfig);

        assert.equal(report.ffmpeg, false);
        assert.equal(report.ffprobe, false);
    });

    it('explains what each missing tool breaks', () => {
        const problems = describeMissingTools({ guessit: false, ffmpeg: false, ffprobe: true });

        assert.equal(problems.length, 2);
        assert.match(problems[0], /guessit.*identified/);
        assert.match(problems[1], /ffmpeg.*pathFFmpeg/);
        assert.deepEqual(describeMissingTools({ guessit: true, ffmpeg: true, ffprobe: true }), []);
    });
});

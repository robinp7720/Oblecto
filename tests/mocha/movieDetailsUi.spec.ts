import assert from 'node:assert/strict';
import { moviePlaybackDetails, movieProviderLinks, crewDepartments } from '../../Oblecto-Web/src/utils/movieDetails.js';
import { formatStreamLabel } from '../../Oblecto-Web/src/utils/media.js';

describe('Movie detail presentation', () => {
    it('estimates finish time from the playable file and uses a full rewatch duration for completed movies', () => {
        const movie = { runtime: 100, Files: [{ duration: 7200 }], TrackMovies: [{ time: 1800, progress: 0.25 }] };
        assert.equal(moviePlaybackDetails(movie).remainingSeconds, 5400);
        assert.equal(moviePlaybackDetails(movie).resuming, true);
        movie.TrackMovies = [{ time: 6900, progress: 0.96 }];
        assert.equal(moviePlaybackDetails(movie).remainingSeconds, 7200);
        assert.equal(moviePlaybackDetails(movie).watched, true);
        assert.equal(moviePlaybackDetails({ runtime: 90 }).remainingSeconds, 5400);
        assert.equal(moviePlaybackDetails({ runtime: 'invalid' }).remainingSeconds, 0);
        assert.equal(moviePlaybackDetails({ runtime: 1, TrackMovies: [{ time: 600, progress: 0.5 }] }).remainingSeconds, 0);
    });

    it('builds provider URLs only from valid movie identifiers', () => {
        assert.deepEqual(movieProviderLinks({ imdbid: 'tt2543164', tmdbid: 329865 }).map(link => link.label), ['IMDb', 'TMDB']);
        assert.deepEqual(movieProviderLinks({ imdbid: 'javascript:alert(1)', tmdbid: -1 }), []);
        assert.deepEqual(movieProviderLinks(null), []);
    });

    it('groups every crew role by department without duplicating a person within a department', () => {
        const groups = crewDepartments([{ person: { id: 1, name: 'One person' }, roles: [
            { job: 'Director', department: 'Directing' }, { job: 'Writer', department: 'Writing' },
            { job: 'Screenplay', department: 'Writing' }, { job: 'Writer', department: 'Writing' }
        ] }]);
        assert.deepEqual(groups.map(group => group.name), ['Directing', 'Writing']);
        assert.equal(groups[1].people.length, 1);
        assert.equal(groups[1].people[0].jobs, 'Writer · Screenplay');
    });

    it('describes commentary and accessible subtitles with readable language names', () => {
        assert.match(formatStreamLabel({ tags_language: 'eng', disposition_comment: 1, channels: 2 }, 'audio'), /English · Stereo · Commentary/);
        assert.match(formatStreamLabel({ tags_language: 'fra', disposition_forced: 1, disposition_hearing_impaired: 1 }, 'subtitle'), /French · Forced · SDH/);
    });
});

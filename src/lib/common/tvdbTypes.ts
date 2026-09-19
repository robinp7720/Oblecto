// The fields Oblecto reads from node-tvdb responses, which ship without types.

export type TvdbEpisode = {
    id: number;
    episodeName?: string;
    airedEpisodeNumber?: number;
    airedSeason?: number;
    overview?: string;
    firstAired?: string;
    dvdEpisodeNumber?: number;
    dvdSeason?: number;
    absoluteNumber?: number;
    imdbId?: string;
    filename?: string;
};

export type TvdbSeries = {
    id: number;
    seriesName?: string;
    status?: string;
    firstAired?: string;
    overview?: string;
    siteRating?: number;
    siteRatingCount?: number;
    rating?: string;
    airsDayOfWeek?: string;
    airsTime?: string;
    network?: string;
    imdbId?: string;
    zap2itId?: string;
};

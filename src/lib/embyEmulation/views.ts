// The library views Jellyfin clients list on their home screen. One definition, so /UserViews,
// /Users/{id}/Views and /Items/{viewId} agree on the ids the item routes understand.

export const LIBRARY_VIEWS = [
    {
        id: 'movies',
        name: 'Movies',
        collectionType: 'movies'
    },
    {
        id: 'shows',
        name: 'Shows',
        collectionType: 'tvshows'
    },
    {
        id: 'collections',
        name: 'Collections',
        collectionType: 'boxsets'
    }
] as const;

export type LibraryViewId = typeof LIBRARY_VIEWS[number]['id'];

// The Jellyfin root folder id; every view hangs off it.
const ROOT_FOLDER_ID = 'e9d5075a555c1cbc394eec4cef295274';

export const isLibraryView = (id: string): id is LibraryViewId => LIBRARY_VIEWS.some(view => view.id === id);

export function libraryView(id: LibraryViewId, serverId: string): Record<string, unknown> {
    const view = LIBRARY_VIEWS.find(entry => entry.id === id)!;

    return {
        Name: view.name,
        ServerId: serverId,
        Id: view.id,
        Etag: view.id,
        CanDelete: false,
        CanDownload: false,
        SortName: view.name.toLowerCase(),
        ExternalUrls: [],
        EnableMediaSourceDisplay: true,
        ChannelId: null,
        Taglines: [],
        Genres: [],
        PlayAccess: 'Full',
        RemoteTrailers: [],
        ProviderIds: {},
        IsFolder: true,
        ParentId: ROOT_FOLDER_ID,
        Type: 'CollectionFolder',
        People: [],
        Studios: [],
        GenreItems: [],
        LocalTrailerCount: 0,
        UserData: {
            PlaybackPositionTicks: 0,
            PlayCount: 0,
            IsFavorite: false,
            Played: false,
            Key: view.id,
            ItemId: '00000000000000000000000000000000'
        },
        SpecialFeatureCount: 0,
        DisplayPreferencesId: view.id,
        Tags: [],
        PrimaryImageAspectRatio: 1.7777777777777777,
        CollectionType: view.collectionType,
        // No artwork of their own: an image tag here would make clients request an image that 404s.
        ImageTags: {},
        BackdropImageTags: [],
        LocationType: 'FileSystem',
        MediaType: 'Unknown',
        LockedFields: [],
        LockData: false
    };
}

export function libraryViews(serverId: string): { Items: Record<string, unknown>[]; TotalRecordCount: number; StartIndex: number } {
    const items = LIBRARY_VIEWS.map(view => libraryView(view.id, serverId));

    return {
 Items: items, TotalRecordCount: items.length, StartIndex: 0 
};
}

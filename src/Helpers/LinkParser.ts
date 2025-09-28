export function parseYTLink(text: string): YTLinkType {
    let list: string | null = null;
    let vid: string | null = null;
    try {
        const u = new URL(text);
        if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
            list = u.searchParams.get('list');
            vid = u.searchParams.get('v');
        }
        else if (u.hostname === 'youtu.be') {
            list = u.searchParams.get('list');
            vid = u.pathname.substring(1);
        }
    } catch {
        // whatever
    }
    if (list) {
        return {
            type: 'playlist',
            list: list,
        };
    }
    if (vid) {
        return {
            type: 'video',
            vid: vid,
        };
    }
    return {
        type: 'invalid',
        query: text,
    };
}

export function parseYMLink(text: string): YMLinkType {
    try {
        const u = new URL(text);
        const tokens = u.pathname.split('/');

        if (tokens.length < 2) {
            return {
                type: 'invalid',
                query: text
            };
        }
        if (tokens.at(-2) === 'track') {
            const trackId = tokens.at(-1);
            return {
                type: 'track',
                track: trackId,
            };
        }
        if (tokens.at(-2) === 'album') {
            const albumId = tokens.at(-1);
            return {
                type: 'album',
                album: albumId,
            };
        }
        if (tokens.at(-2) === 'playlists' && tokens.length > 2) {
            const userId = tokens.at(-3);
            const playlistId = tokens.at(-1);
            return {
                type: 'playlist',
                user: userId,
                playlist: playlistId,
            };
        }
    }
    catch {
        // whatever
    }

    return {
        type: 'invalid',
        query: text,
    };
}


export type YTLinkType = YTLinkVideo | YTLinkPlaylist | YTLinkInvalid;
interface YTLinkVideo {
    type: 'video'
    vid: string
}
interface YTLinkPlaylist {
    type: 'playlist'
    list: string
}
interface YTLinkInvalid {
    type: 'invalid'
    query: string
}

export type YMLinkType = YMLinkTrack | YMLinkAlbum | YMLinkPlaylist | YMLinkInvalid;
interface YMLinkTrack {
    type: 'track'
    track: string
}
interface YMLinkAlbum {
    type: 'album'
    album: string
}
interface YMLinkPlaylist {
    type: 'playlist'
    user: string
    playlist: string
}
interface YMLinkInvalid {
    type: 'invalid'
    query: string
}

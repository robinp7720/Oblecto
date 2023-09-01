export const createStreamsList = (streams) => {
    let mediaStreams = [];

    for (const stream of streams) {
        switch (stream.codec_type) {
            case 'video':
                mediaStreams.push({
                    'Codec': stream.codec_name,
                    'Language': 'eng',
                    'ColorTransfer': stream.color_transfer,
                    'ColorPrimaries': stream.color_primaries,
                    'TimeBase': stream.time_base,
                    'CodecTimeBase': stream.codec_time_base,
                    'VideoRange': stream.color_range,
                    'DisplayTitle': '1080p H264',
                    'NalLengthSize': '0',
                    'IsInterlaced': false,
                    'IsAVC': false,
                    'BitRate': 9253220,
                    'BitDepth': 8,
                    'RefFrames': 1,
                    'IsDefault': true,
                    'IsForced': false,
                    'Height': stream.height,
                    'Width': stream.width,
                    'AverageFrameRate': 23.976025,
                    'RealFrameRate': 23.976025,
                    'Profile': 'High',
                    'Type': 'Video',
                    'AspectRatio': stream.display_aspect_ratio,
                    'Index': stream.index,
                    'IsExternal': false,
                    'IsTextSubtitleStream': false,
                    'SupportsExternalStream': false,
                    'PixelFormat': stream.pix_fmt,
                    'Level': 40
                });
                break;
            case 'audio':
                mediaStreams.push({
                    'Codec': stream.codec_name,
                    'Language': stream.tags_language,
                    'TimeBase': stream.time_base,
                    'CodecTimeBase': stream.codec_time_base,
                    'Title': 'English',
                    'DisplayTitle': 'Eng Dolby Digital+ 6 ch Default',
                    'IsInterlaced': false,
                    'Channels': 6,
                    'SampleRate': 48000,
                    'IsDefault': true,
                    'IsForced': false,
                    'Type': 'Audio',
                    'Index': stream.index,
                    'IsExternal': false,
                    'IsTextSubtitleStream': false,
                    'SupportsExternalStream': false,
                    'Level': 0
                });
                break;
            case 'subtitle':
                mediaStreams.push({
                    'Codec': stream.codec_name,
                    'Language': stream.tags_language,
                    'TimeBase': stream.time_base,
                    'CodecTimeBase': stream.codec_time_base,
                    'Title': '',
                    'localizedUndefined': 'Undefined',
                    'localizedDefault': 'Default',
                    'localizedForced': 'Forced',
                    'DisplayTitle': '',
                    'IsInterlaced': false,
                    'IsDefault': false,
                    'IsForced': false,
                    'Type': 'Subtitle',
                    'Index': stream.index,
                    'IsExternal': false,
                    'IsTextSubtitleStream': true,
                    'SupportsExternalStream': true,
                    'Level': 0
                });
                break;
        }
    }

    return mediaStreams;
};

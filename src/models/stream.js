import { DataTypes, Model } from 'sequelize';

export class Stream extends Model {}

export const streamColumns = {
    index: DataTypes.INTEGER,
    codec_name: DataTypes.STRING,
    profile: DataTypes.STRING,
    codec_type: DataTypes.STRING,

    codec_time_base: DataTypes.STRING,
    codec_tag_string: DataTypes.STRING,

    sample_fmt: DataTypes.STRING,
    sample_rate: DataTypes.INTEGER,
    bits_per_sample: DataTypes.INTEGER,

    channels: DataTypes.INTEGER,
    channel_layout: DataTypes.STRING,

    width: DataTypes.INTEGER,
    height: DataTypes.INTEGER,

    coded_width: DataTypes.INTEGER,
    coded_height: DataTypes.INTEGER,

    has_b_frames: DataTypes.INTEGER,

    sample_aspect_ratio: DataTypes.STRING,
    display_aspect_ratio: DataTypes.STRING,
    pix_fmt: DataTypes.STRING,

    level: DataTypes.INTEGER,

    color_range: DataTypes.STRING,
    color_space: DataTypes.STRING,
    color_transfer: DataTypes.STRING,
    color_primaries: DataTypes.STRING,
    chroma_location: DataTypes.STRING,

    field_order: DataTypes.STRING,
    timecode: DataTypes.INTEGER,

    refs: DataTypes.INTEGER,

    is_avc: DataTypes.BOOLEAN,
    nal_length_size: DataTypes.INTEGER,

    stream_id: DataTypes.STRING,

    r_frame_rate: DataTypes.STRING,
    avg_frame_rate: DataTypes.STRING,

    time_base: DataTypes.STRING,

    start_pts: DataTypes.BIGINT,
    start_time: DataTypes.INTEGER,

    duration_ts: DataTypes.BIGINT,
    duration: DataTypes.INTEGER,

    bit_rate: DataTypes.INTEGER,
    max_bit_rate: DataTypes.INTEGER,
    bits_per_raw_sample: DataTypes.INTEGER,
    nb_frames: DataTypes.INTEGER,
    nb_read_frames: DataTypes.INTEGER,
    nb_read_packets: DataTypes.INTEGER,

    disposition_default: DataTypes.INTEGER,
    disposition_dub: DataTypes.INTEGER,
    disposition_original: DataTypes.INTEGER,
    disposition_comment: DataTypes.INTEGER,
    disposition_lyrics: DataTypes.INTEGER,
    disposition_karaoke: DataTypes.INTEGER,
    disposition_forced: DataTypes.INTEGER,
    disposition_hearing_impaired: DataTypes.INTEGER,
    disposition_clean_effects: DataTypes.INTEGER,
    disposition_attached_pic: DataTypes.INTEGER,
    disposition_timed_thumbnails: DataTypes.INTEGER,

    tags_language: DataTypes.STRING,
    tags_title: DataTypes.STRING,

    dmix_mode: DataTypes.INTEGER,
    ltrt_cmixlev: DataTypes.INTEGER,
    ltrt_surmixlev: DataTypes.INTEGER,
    loro_cmixlev: DataTypes.INTEGER,
    loro_surmixlev: DataTypes.INTEGER,

    quarter_sample: DataTypes.BOOLEAN,
    divx_packed: DataTypes.BOOLEAN,

    side_data_type: DataTypes.STRING,
    closed_captions: DataTypes.BOOLEAN,

    extradata_size: DataTypes.INTEGER,
    film_grain: DataTypes.STRING,

    dv_version_major: DataTypes.STRING,
    dv_version_minor: DataTypes.STRING,
    dv_profile: DataTypes.STRING,
    dv_level: DataTypes.STRING,
    rpu_present_flag: DataTypes.STRING,
    el_present_flag: DataTypes.STRING,
    bl_present_flag: DataTypes.STRING,
    dv_bl_signal_compatibility_id: DataTypes.STRING,

    max_content: DataTypes.STRING,
    max_average: DataTypes.STRING,
    red_x: DataTypes.STRING,
    red_y: DataTypes.STRING,
    green_x: DataTypes.STRING,
    green_y: DataTypes.STRING,
    blue_x: DataTypes.STRING,
    blue_y: DataTypes.STRING,
    white_point_y: DataTypes.STRING,
    white_point_x: DataTypes.STRING,
    min_luminance: DataTypes.STRING,
    max_luminance: DataTypes.STRING
};

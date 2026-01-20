import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Stream extends Model<InferAttributes<Stream>, InferCreationAttributes<Stream>> {
    declare id: CreationOptional<number>;

    declare index: number | null;
    declare codec_name: string | null;
    declare profile: string | null;
    declare codec_type: string | null;

    declare codec_time_base: string | null;
    declare codec_tag_string: string | null;

    declare sample_fmt: string | null;
    declare sample_rate: number | null;
    declare bits_per_sample: number | null;

    declare channels: number | null;
    declare channel_layout: string | null;

    declare width: number | null;
    declare height: number | null;

    declare coded_width: number | null;
    declare coded_height: number | null;

    declare has_b_frames: number | null;

    declare sample_aspect_ratio: string | null;
    declare display_aspect_ratio: string | null;
    declare pix_fmt: string | null;

    declare level: number | null;

    declare color_range: string | null;
    declare color_space: string | null;
    declare color_transfer: string | null;
    declare color_primaries: string | null;
    declare chroma_location: string | null;

    declare field_order: string | null;
    declare timecode: number | null;

    declare refs: number | null;

    declare is_avc: boolean | null;
    declare nal_length_size: number | null;

    declare stream_id: string | null;

    declare r_frame_rate: string | null;
    declare avg_frame_rate: string | null;

    declare time_base: string | null;

    declare start_pts: number | null; // BIGINT
    declare start_time: number | null;

    declare duration_ts: number | null; // BIGINT
    declare duration: number | null;

    declare bit_rate: number | null;
    declare max_bit_rate: number | null;
    declare bits_per_raw_sample: number | null;
    declare nb_frames: number | null;
    declare nb_read_frames: number | null;
    declare nb_read_packets: number | null;

    declare disposition_default: number | null;
    declare disposition_dub: number | null;
    declare disposition_original: number | null;
    declare disposition_comment: number | null;
    declare disposition_lyrics: number | null;
    declare disposition_karaoke: number | null;
    declare disposition_forced: number | null;
    declare disposition_hearing_impaired: number | null;
    declare disposition_clean_effects: number | null;
    declare disposition_attached_pic: number | null;
    declare disposition_timed_thumbnails: number | null;

    declare tags_language: string | null;
    declare tags_title: string | null;

    declare dmix_mode: number | null;
    declare ltrt_cmixlev: number | null;
    declare ltrt_surmixlev: number | null;
    declare loro_cmixlev: number | null;
    declare loro_surmixlev: number | null;

    declare quarter_sample: boolean | null;
    declare divx_packed: boolean | null;

    declare side_data_type: string | null;
    declare closed_captions: boolean | null;

    declare extradata_size: number | null;
    declare film_grain: string | null;

    declare dv_version_major: string | null;
    declare dv_version_minor: string | null;
    declare dv_profile: string | null;
    declare dv_level: string | null;
    declare rpu_present_flag: string | null;
    declare el_present_flag: string | null;
    declare bl_present_flag: string | null;
    declare dv_bl_signal_compatibility_id: string | null;

    declare initial_padding: number | null;
    declare view_ids_available: string | null;
    declare view_pos_available: string | null;
    declare dv_md_compression: string | null;

    declare max_content: string | null;
    declare max_average: string | null;
    declare red_x: string | null;
    declare red_y: string | null;
    declare green_x: string | null;
    declare green_y: string | null;
    declare blue_x: string | null;
    declare blue_y: string | null;
    declare white_point_y: string | null;
    declare white_point_x: string | null;
    declare min_luminance: string | null;
    declare max_luminance: string | null;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const streamColumns = {
    id: {
 type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true 
},
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

    initial_padding: DataTypes.INTEGER,
    view_ids_available: DataTypes.STRING,
    view_pos_available: DataTypes.STRING,
    dv_md_compression: DataTypes.STRING,

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
    max_luminance: DataTypes.STRING,

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('episodes', {
        tvdbid: { type: DataTypes.INTEGER, allowNull: true, unique: true },
        showid: { type: DataTypes.INTEGER, allowNull: true },

        episodeName: DataTypes.STRING,

        absoluteNumber: DataTypes.INTEGER,
        airedEpisodeNumber: DataTypes.INTEGER,
        airedSeason: DataTypes.INTEGER,
        dvdEpisodeNumber: DataTypes.DOUBLE,
        dvdSeason: DataTypes.INTEGER,

        firstAired: DataTypes.DATEONLY,
        overview: DataTypes.TEXT,
    });
};

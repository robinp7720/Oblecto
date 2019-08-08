module.exports = (sequelize, DataTypes) => {
    return sequelize.define('movies', {
        tmdbid: { type: DataTypes.INTEGER, allowNull: true, unique: true },

        movieName: DataTypes.STRING,

        popularity: DataTypes.FLOAT,

        releaseDate: DataTypes.DATEONLY,
        overview: DataTypes.TEXT,
    });
};
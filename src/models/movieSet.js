module.exports = (sequelize, DataTypes) => {
    return sequelize.define('movieSets', {
        setName: DataTypes.STRING,
        overview: DataTypes.TEXT,
        tmdbid: {type: DataTypes.INTEGER, allowNull: true, unique: true},
    });
};

module.exports = (sequelize, DataTypes) => {
    return sequelize.define("trackEpisodes", {
        time: DataTypes.FLOAT,
        progress: DataTypes.FLOAT,
    })
}
module.exports = (sequelize, DataTypes) => {
    return sequelize.define("trackMovies", {
        time: DataTypes.FLOAT,
        progress: DataTypes.FLOAT,
    })
}
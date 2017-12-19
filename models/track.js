module.exports = (sequelize, DataTypes) => {
    return sequelize.define("track", {
        time: DataTypes.FLOAT,
        progress: DataTypes.FLOAT,
    })
}
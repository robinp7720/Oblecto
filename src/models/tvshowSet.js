module.exports = (sequelize, DataTypes) => {
    return sequelize.define('tvshowSet', {
        setName: DataTypes.STRING,
        overview: DataTypes.TEXT,
    });
};
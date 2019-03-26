module.exports = (sequelize, DataTypes) => {
    return sequelize.define('file', {
        path: DataTypes.STRING,

        name: DataTypes.STRING,
        directory: DataTypes.STRING,
        extension: DataTypes.STRING,
        container: DataTypes.STRING,

        duration: DataTypes.DOUBLE,

    });
};
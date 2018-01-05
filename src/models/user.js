module.exports = (sequelize, DataTypes) => {
    return sequelize.define("users", {
        username:  DataTypes.STRING(16),
        name: DataTypes.STRING,
        email: DataTypes.STRING,
        password: DataTypes.STRING,
        access_token: { type: DataTypes.STRING, allowNull: true},
    })
}
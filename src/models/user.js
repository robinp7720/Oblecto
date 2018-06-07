module.exports = (sequelize, DataTypes) => {
    return sequelize.define('users', {
        username:  { type: DataTypes.STRING(16), unique: true },
        name: DataTypes.STRING,
        email: DataTypes.STRING,
        password: DataTypes.STRING,
        access_token: { type: DataTypes.STRING, allowNull: true},
    });
};
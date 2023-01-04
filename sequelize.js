const { Sequelize } = require('sequelize');
const config = require('./config')

const sequelize = new Sequelize(config.DATABASE, config.USER, config.PASSWORD, {
    host: config.HOST,
    dialect: 'mysql',
    logging: false
});

module.exports = sequelize
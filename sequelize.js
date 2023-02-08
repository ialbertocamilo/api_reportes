const { Sequelize } = require('sequelize')
const config = require('./config')

const sequelize = new Sequelize(config.DATABASE, config.USER, config.PASSWORD, {
  host: config.HOST,
  dialect: 'mysql',
  port: config.DB_PORT,
  logging: false,
  timezone: '-05:00'
})

module.exports = sequelize

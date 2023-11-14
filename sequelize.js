const { Sequelize } = require('sequelize')
const config = require('./config')

const sequelize = new Sequelize(config.DATABASE, config.USER, config.PASSWORD, {  
  dialect: 'mysql',
  port: config.DB_PORT,
  logging: false,
  timezone: '-05:00',
  replication: {
    read: [
      { host: config.HOST, username: config.USER,  password:config.PASSWORD}      
    ],
    write: { host: config.HOST_WRITE, username: config.USER,  password:config.PASSWORD }
    
  },

})

module.exports = sequelize

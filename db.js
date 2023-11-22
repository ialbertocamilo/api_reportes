const config = require('./config')

exports.con = require('knex')({
  client: 'mysql2',
  version: '5.7',
  connection: {
    port: config.DB_PORT,
    host: config.HOST,
    user: config.USER,
    password: config.PASSWORD,
    database: config.DATABASE
  }
  
})

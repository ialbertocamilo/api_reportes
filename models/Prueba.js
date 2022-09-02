const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')

class Prueba extends Model {
}
Prueba.init({
    usuario_id:DataTypes.INTEGER,
    config_id:DataTypes.INTEGER,
    categoria_id:DataTypes.INTEGER,
    curso_id:DataTypes.INTEGER,
    posteo_id:DataTypes.INTEGER,
    nota:DataTypes.DOUBLE,
    puntaje:DataTypes.DOUBLE,
    last_ev:DataTypes.DATE,
    intentos:DataTypes.INTEGER,
},{
    sequelize,
    modelName:'pruebas',
    tableName:'pruebas'
})

module.exports = Prueba;
const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')

class Reinicio extends Model {
}
Reinicio.init({
    usuario_id:DataTypes.INTEGER,
    curso_id:DataTypes.INTEGER,
    posteo_id:DataTypes.INTEGER,
    acumulado:DataTypes.INTEGER,
    tipo:DataTypes.STRING(120),
},{
    sequelize,
    modelName:'reinicios',
    tableName:'reinicios'
})

module.exports = Reinicio;
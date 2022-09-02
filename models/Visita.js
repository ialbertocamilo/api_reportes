const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')

class Visita extends Model {
}
Visita.init({
    usuario_id:DataTypes.INTEGER,
    post_id:DataTypes.INTEGER,
    curso_id:DataTypes.INTEGER,
    estado_tema:DataTypes.STRING(120),
    sumatoria:DataTypes.INTEGER,
},{
    sequelize,
    modelName:'visitas',
    tableName:'visitas'
})

module.exports = Visita;
const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')

class TipoCriterios extends Model {
}
TipoCriterios.init({
    nombre:DataTypes.STRING(255),
    orden:DataTypes.INTEGER,
    en_reportes:DataTypes.INTEGER,
},{
    sequelize,
    modelName:'tipo_criterios',
    tableName:'tipo_criterios'
})

module.exports = TipoCriterios;
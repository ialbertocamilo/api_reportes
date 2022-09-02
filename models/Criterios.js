const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')
const TipoCriterios = require('./TipoCriterios.js');

class Criterios extends Model {
}
Criterios.init({
    nombre:DataTypes.STRING(255),
    tipo_criterio_id:DataTypes.INTEGER,
},{
    sequelize,
    modelName:'criterios',
    tableName:'criterios'
})
Criterios.belongsTo(TipoCriterios,{
    foreignKey:'tipo_criterio_id',
    sourceKey:'id',
})
module.exports = Criterios;
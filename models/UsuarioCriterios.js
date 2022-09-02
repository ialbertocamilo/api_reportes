const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js');
const criterios = require('./Criterios');

class UsuarioCriterios extends Model {
}
UsuarioCriterios.init({
    usuario_id:DataTypes.INTEGER,
    criterio_id:DataTypes.INTEGER,
    origen:DataTypes.INTEGER,
    estado:DataTypes.DATE,
},{
    sequelize,
    modelName:"usuario_criterios",
    tableName:'usuario_criterios'
})
UsuarioCriterios.belongsTo(criterios,{
    foreignKey:'criterio_id',
    sourceKey:'id',
})
module.exports = UsuarioCriterios;
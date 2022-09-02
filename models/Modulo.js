const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')

class Modulo extends Model {
}
Modulo.init({
    etapa:DataTypes.STRING(45),
    estado:DataTypes.INTEGER,
    mod_evaluaciones:DataTypes.STRING(255),
},{
    sequelize,
    modelName:'modulo',
    tableName:'ab_config'
})

module.exports = Modulo;
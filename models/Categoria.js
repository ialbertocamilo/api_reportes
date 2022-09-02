const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')

class Categoria extends Model {
}
Categoria.init({
    config_id:DataTypes.INTEGER,
    nombre:DataTypes.STRING(120),
    estado:DataTypes.INTEGER,
    estado_diploma:DataTypes.INTEGER,
    orden:DataTypes.INTEGER,
},{
    sequelize,
    modelName:"categorias"
})

module.exports = Categoria;
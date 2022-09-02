const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')
const curso = require('./Curso');
const categoria = require('./Categoria');

class Tema extends Model {
}
Tema.init({
    categoria_id:DataTypes.INTEGER,
    curso_id:DataTypes.INTEGER,
    nombre:DataTypes.STRING(120),
    evaluable:DataTypes.STRING(10),
    tipo_ev:DataTypes.STRING(10),
    tipo_cal:DataTypes.STRING(10),
    estado:DataTypes.INTEGER,
    orden:DataTypes.INTEGER,
},{
    sequelize,
    modelName:'tema',
    tableName:'posteos'
})

Tema.belongsTo(categoria,{
    foreignKey:'categoria_id',
    sourceKey:'id',
});

module.exports = Tema;
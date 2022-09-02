const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')
const categoria = require('./Categoria');
const modulo = require('./Modulo');
const tema = require('./Tema');

class Curso extends Model {
}
Curso.init({
    config_id:DataTypes.INTEGER,
    estado:DataTypes.INTEGER,
    categoria_id:DataTypes.INTEGER,
    requisito_id:DataTypes.INTEGER,
    nombre:DataTypes.STRING(120),
    mod_evaluaciones:DataTypes.STRING(255),
    estado:DataTypes.INTEGER,
    orden:DataTypes.INTEGER,
},{
    sequelize,
    modelName:'curso',
    tableName:'cursos'
})
Curso.belongsTo(categoria,{
    foreignKey:'categoria_id',
    sourceKey:'id',
})
Curso.belongsTo(modulo,{
    foreignKey:'config_id',
    sourceKey:'id',
})

Curso.hasMany(tema,{
    foreignKey:'curso_id',
})
tema.belongsTo(Curso,{
    foreignKey:'curso_id',
    sourceKey:'id',
})
module.exports = Curso;
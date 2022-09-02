const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js');
const curso = require('./Curso');
const categoria = require('./Categoria');
const usuario_cursos = require('./UsuarioCurso');
const usuario = require('./Usuario');

class Diploma extends Model {
}
Diploma.init({
    curso_id:DataTypes.INTEGER,
    usuario_id:DataTypes.INTEGER,
    categoria_id:DataTypes.INTEGER,
    fecha_emision:DataTypes.DATE,
    check_apb:DataTypes.INTEGER,
},{
    sequelize,
    modelName:"diplomas",
    tableName:'diplomas'
})

Diploma.hasOne(curso,{
    foreignKey:'id',
    sourceKey:'curso_id',
})
Diploma.hasOne(categoria,{
    foreignKey:'id',
    sourceKey:'categoria_id',
})
Diploma.hasOne(usuario,{
    foreignKey:'id',
    sourceKey:'usuario_id',
})

// Diploma.hasMany(usuario_cursos,{
//     foreignKey:'usuario_id',
//     sourceKey:'usuario_id',
// })
// Diploma.hasMany(usuario_cursos,{
//     foreignKey:'curso_id',
//     sourceKey:'curso_id',
// })
module.exports = Diploma;
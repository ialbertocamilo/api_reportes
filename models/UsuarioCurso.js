const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js');
const curso = require('./Curso');

class UsuarioCurso extends Model {
}
UsuarioCurso.init({
    usuario_id:DataTypes.INTEGER,
    curso_id:DataTypes.INTEGER,
    origen:DataTypes.INTEGER,
    estado:DataTypes.DATE,
},{
    sequelize,
    modelName:"usuario_cursos",
    tableName:'usuario_cursos'
})
UsuarioCurso.belongsTo(curso,{
    foreignKey:'curso_id',
    sourceKey:'id',
})
module.exports = UsuarioCurso;
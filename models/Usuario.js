const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js');
const resumen_x_curso = require('./ResumenCurso');
const modulo = require('./Modulo');
const UsuarioCurso = require('./UsuarioCurso.js');
const UsuarioCriterios = require('./UsuarioCriterios.js');
const Prueba = require('./Prueba.js');
const Visita = require('./Visita.js');
const Reinicio = require('./Reinicio.js');
class Usuario extends Model {
}
Usuario.init({
    config_id:DataTypes.INTEGER,
    nombre:DataTypes.STRING(100),
    apellido_paterno:DataTypes.STRING(100),
    apellido_materno:DataTypes.STRING(100),
    dni:DataTypes.STRING(20),
    email:DataTypes.STRING(60),
    sexo:DataTypes.STRING(1),
    ultima_sesion:DataTypes.DATE,
    rol:DataTypes.STRING(10),
    estado:DataTypes.INTEGER,
},{
    sequelize,
    modelName:"usuarios"
})

Usuario.hasMany(resumen_x_curso,{
    foreignKey:'usuario_id'
})

Usuario.hasMany(UsuarioCurso,{
    foreignKey:'usuario_id'
})

Usuario.hasMany(UsuarioCriterios,{
    foreignKey:'usuario_id'
})

Usuario.hasMany(Prueba,{
    foreignKey:'usuario_id'
})

Usuario.hasMany(Visita,{
    foreignKey:'usuario_id'
})

Usuario.hasMany(Reinicio,{
    foreignKey:'usuario_id'
})

Usuario.belongsTo(modulo,{
    foreignKey:'config_id',
    sourceKey:'id',
})
module.exports = Usuario;
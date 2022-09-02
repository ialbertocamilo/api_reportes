const {Model,DataTypes} = require('sequelize');
const sequelize = require('../sequelize.js')

class ResumenCurso extends Model {
}
ResumenCurso.init({
    usuario_id:DataTypes.INTEGER,
    estado_rxc:DataTypes.INTEGER,
    curso_id:DataTypes.INTEGER,
    categoria_id:DataTypes.INTEGER,
    asignados:DataTypes.INTEGER,
    aprobados:DataTypes.INTEGER,
    realizados:DataTypes.INTEGER,
    revisados:DataTypes.INTEGER,
    desaprobados:DataTypes.INTEGER,
    nota_prom:DataTypes.DECIMAL(10,2),
    intentos:DataTypes.INTEGER,
    visitas:DataTypes.INTEGER,
    estado:DataTypes.INTEGER,
    porcentaje:DataTypes.INTEGER,
    last_ev:DataTypes.INTEGER,
    //Virtual column
    sum_completados:DataTypes.INTEGER
},{
    sequelize,
    modelName:"resumen_x_curso",
    tableName:"resumen_x_curso"
})

module.exports = ResumenCurso;
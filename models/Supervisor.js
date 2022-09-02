const {Model,DataTypes,Sequelize} = require('sequelize');
const sequelize = require('../sequelize.js');
const UsuarioCriterios = require('./UsuarioCriterios.js');
const Usuario = require('./Usuario.js');
const Criterios = require('./Criterios.js');

class Supervisor extends Model {
}
Supervisor.usuariosXSupervisor = async (usuario_supervisor_id)=>{
    const usuario_supervisor = await Usuario.findOne({
        attributes:['config_id','id'],
        where:{
            id:usuario_supervisor_id
        }
    })
    const usuarios_supervisor = await Promise.all([
        usuariosIdXDni(usuario_supervisor),usuariosIdXCriterios(usuario_supervisor)
    ]);
    const usuarios_x_dni = await Usuario.findAll({
        attributes:['id','nombre','apellido_paterno','apellido_materno','ultima_sesion','dni','config_id','estado'],
        where:{
            id:usuarios_supervisor[0],
            estado:1,
            rol:'default'
        },
    })
    const usuarios_x_criterio = await Usuario.findAll({
        attributes:['id','nombre','apellido_paterno','apellido_materno','ultima_sesion','dni','config_id','estado'],
        where:{
            id:usuarios_supervisor[1],
            config_id:usuario_supervisor.config_id,
            estado:1,
            rol:'default'
        },
    })
    
    return [...usuarios_x_dni,...usuarios_x_criterio];
}
usuariosIdXDni = async (usuario_supervisor) => {
    const usuario_supervisor_dni = await Supervisor.findAll({
        attributes:['resource_id'],
        where: {
            usuario_id: usuario_supervisor.id,
            type:'dni'
        }
    })
    return usuario_supervisor_dni.map(e=>e.resource_id)
}
usuariosIdXCriterios = async (usuario_supervisor)=>{
        
    const usuario_supervisor_tipo_criterios = await Supervisor.findAll({
        attributes:['resource_id'],
        where: {
            usuario_id: usuario_supervisor.id,
            type:'criterios'
        }
    })

    const usuario_supervisor_criterios = await UsuarioCriterios.findAll({
                                            attributes:['criterio_id'],
                                            where: {
                                                usuario_id: usuario_supervisor.id,
                                            },
                                            include:{
                                                model: Criterios,
                                                required: true,
                                                attributes: ['id'],
                                                where:{
                                                    tipo_criterio_id:usuario_supervisor_tipo_criterios.map(e=>e.resource_id)
                                                }
                                            },
                                            raw : true
                                        })

    const criterios_usuarios_id = await UsuarioCriterios.findAll({
                                            attributes:['usuario_id',[Sequelize.fn('COUNT', Sequelize.col('usuario_id')), 'count_usuarios']],
                                            where: {
                                                criterio_id: usuario_supervisor_criterios.map(e=>e.criterio_id),
                                            },
                                            group: ['usuario_id'],
                                            having: Sequelize.literal(`count_usuarios = ${usuario_supervisor_criterios.length}`),
                                            // include:{
                                            //     model:Usuario,
                                            //     attributes:['id'],
                                            //     where:{
                                            //         config_id:usuario.config_id,
                                            //         estado:1,
                                            //         rol:'default'
                                            //     },
                                            //     required:true
                                            // }
                                        })
    return criterios_usuarios_id.map(e=>e.usuario_id);
}
Supervisor.init({
    usuario_id:DataTypes.INTEGER,
    criterio_id:DataTypes.INTEGER,
    type:DataTypes.STRING(20),
    resource_id:DataTypes.INTEGER,
},{
    sequelize,
    modelName:"supervisores"
})
Supervisor.hasMany(UsuarioCriterios,{
    foreignKey:'usuario_id'
})
Supervisor.belongsTo(Usuario,{
    foreignKey:'usuario_id',
    sourceKey:'id',
})
module.exports = Supervisor;
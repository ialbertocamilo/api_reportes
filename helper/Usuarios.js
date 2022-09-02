const { con } = require('../db')

exports.getUsuarios = (modulos, UsuariosActivos, UsuariosInactivos) => {

    if (modulos && UsuariosActivos && UsuariosInactivos) {
        // console.log('default');
        return con('usuarios').whereIn('config_id', modulos).andWhere('rol', 'default')
    }
    else if (modulos && UsuariosActivos && !UsuariosInactivos) {
        // console.log('Estado 1');
        return con('usuarios').whereIn('config_id', modulos).andWhere('rol', 'default').andWhere('estado', 1)
    }
    else if (modulos && !UsuariosActivos && UsuariosInactivos) {
        // console.log('Estado 0');
        return con('usuarios').whereIn('config_id', modulos).andWhere('rol', 'default').andWhere('estado', 0)
    }
    else if (modulos && !UsuariosActivos && !UsuariosInactivos) {
        // console.log('Nada ');
        return []
    }
    else if (!modulos) {
        // console.log('Nada ');
        return []
    }
}
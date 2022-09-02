const { con } = require('../db')

let TiposCriterios = null

async function getTipoCriterios() {
    return await con('tipo_criterios').select('id', 'nombre').where('en_reportes', 1)
}

const CriteriosUsuarios = con.raw(`SELECT uc.usuario_id, c.nombre, tc.id
from criterios as c
INNER JOIN usuario_criterios as uc on c.id=uc.criterio_id
INNER JOIN tipo_criterios as tc on c.tipo_criterio_id=tc.id WHERE tc.id in (Select id from tipo_criterios WHERE en_reportes = 1)`).then(([rows]) => rows)

exports.getCriteriosPorUsuario = async (us_id) => {

    if (!TiposCriterios) {
        TiposCriterios = await getTipoCriterios()
    }

    let Criterios = await CriteriosUsuarios
    let UsuarioCriterios = []
    Criterios.map(obj => obj.usuario_id == us_id ? UsuarioCriterios.push(obj) : "")
    if (UsuarioCriterios.length != TiposCriterios.length) {
        while (UsuarioCriterios.length < TiposCriterios.length) {
            UsuarioCriterios.push('-')
        }
    }
    return UsuarioCriterios
}

exports.getHeadersEstaticos = async () => {
    const Headers = ['MODULO', 'NOMBRE', 'APELLIDO PATERNO', 'APELLIDO MATERNO', 'DNI','EMAIL','ESTADO(USUARIO)']
    if (!TiposCriterios) {
        TiposCriterios = await getTipoCriterios()
    }

    TiposCriterios.forEach(el => {
        Headers.push(el.nombre)
    });

    return Headers
}
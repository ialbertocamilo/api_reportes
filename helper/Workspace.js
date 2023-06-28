const { con } = require('../db')
const { pluck } = require('./Helper')

exports.getSuboworkspacesIds = async (workspaceId) => {
  const subworkspaces = await con('workspaces')
    .where('active', 1)
    .where('parent_id', workspaceId)

  return pluck(subworkspaces, 'id')
}

exports.getCriterioFechaReconocimiento = async (workspaceId) => {
  return await con('workspaces')
    .select('criterio_id_fecha_inicio_reconocimiento')
    .where('active', 1)
    .where('id', workspaceId)
    .first();
}

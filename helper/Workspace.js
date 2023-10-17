const { con } = require('../db')
const { pluck } = require('./Helper')

exports.getSuboworkspacesIds = async (workspaceId,type = 'only_id') => {
  const subworkspaces = await con('workspaces')
    .where('active', 1)
    .where('parent_id', workspaceId)
  if(type == 'only_id'){
    return pluck(subworkspaces, 'id')
  }
  return subworkspaces
}

exports.getAdminSubworkpacesIds = async (adminId) => {

  if (!adminId) return []

  const [subworkspaces] = await con.raw(`
    select
      *
    from subworkspace_user su where
      su.user_id = ${adminId}`
  );

  return pluck(subworkspaces, 'subworkspace_id');
}

exports.loadWorkspace = async (workspaceId) => {

  if (!workspaceId) return null;

  const [workspaces] = await con.raw(`
    select * from workspaces where id = ${workspaceId}
  `);

  return workspaces[0] || null;
}

exports.getCriterioFechaReconocimiento = async (workspaceId) => {
  return await con('workspaces')
    .select('criterio_id_fecha_inicio_reconocimiento')
    .where('active', 1)
    .where('id', workspaceId)
    .first();
}

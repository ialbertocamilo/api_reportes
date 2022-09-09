const { con } = require('../db')
const { pluck } = require('./Helper')

exports.getSuboworkspacesIds = async (workspaceId) => {
  const modules = await con('workspaces')
    .where('parent_id', workspaceId)

  return pluck(modules, 'id')
}

const { con } = require('../db')
const { pluck } = require('./Helper')

exports.getSuboworkspacesIds = async (workspaceId) => {
  const subworkspaces = await con('workspaces')
    .where('parent_id', workspaceId)

  return pluck(subworkspaces, 'id')
}

const { con } = require('../db')
const { logtime } = require('./Helper')

exports.getWorkspaceCriteria = async (workspaceId) => {
  logtime('method: getWorkspaceCriteria')
  const [rows] = await con.raw(`
        select 
            c.*
        from 
            criteria c 
                inner join criterion_workspace cw on c.id = cw.criterion_id
                inner join workspaces w on w.id = cw.workspace_id
        where 
            w.id = :workspaceId and 
            c.show_in_reports = 1 and
            w.active = 1 and
            c.active = 1
    `,
  { workspaceId }
  )

  return rows
}

exports.getGenericHeaders = async (workspaceId) => {
  const headers = [
    'Nombre', 'Apellido Paterno', 'Apellido Materno',
    'Documento', 'Estado (Usuario)'
  ]

  const workspaceCriteria = await exports.getWorkspaceCriteria(workspaceId)
  workspaceCriteria.forEach(el => headers.push(el.name))
  return headers
}

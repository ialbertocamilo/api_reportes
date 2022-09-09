const { con } = require('../db')

exports.getWorkspaceCriteria = async (workspaceId) => {
  const [rows] = await con.raw(`
        select 
            c.*
        from 
            criteria c 
                inner join criterion_workspace cw on c.id = cw.criterion_id
                inner join workspaces w on w.id = cw.workspace_id
        where 
            w.id = :workspaceId and 
            w.active = 1 and
            c.active = 1
    `,
  { workspaceId }
  )

  return rows
}

exports.getHeadersEstaticos = async (workspaceId) => {
  const headers = [
    'MODULO', 'NOMBRE', 'APELLIDO PATERNO', 'APELLIDO MATERNO',
    'DOCUMENT', 'EMAIL', 'ESTADO(USUARIO)'
  ]

  const workspaceCriteria = await exports.getWorkspaceCriteria(workspaceId)
  workspaceCriteria.forEach(el => headers.push(el.name))
  return headers
}

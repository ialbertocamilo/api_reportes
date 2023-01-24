const { con } = require('../db')
const { logtime } = require('./Helper')

exports.getWorkspaceCriteria = async (workspaceId,criteria_id=[]) => {
  logtime('method: getWorkspaceCriteria')

  let query = `
        select 
            c.*
        from 
            criteria c 
                inner join criterion_workspace cw on c.id = cw.criterion_id
                inner join workspaces w on w.id = cw.workspace_id
        where 
            w.id = :workspaceId and 
            ${criteria_id.length > 0 ? ` c.id in (${criteria_id.toString()}) and ` : ''}
            c.show_in_reports = 1 and
            w.active = 1 and
            c.active = 1
        group by c.id
    `
  // logtime(query)

  const [rows] = await con.raw(query, { workspaceId })

  return rows
}

exports.getGenericHeadersNotasXCurso = async (workspaceId,criteria_id=[]) => {
  const headers = [
    'Nombre', 'Apellido Paterno', 'Apellido Materno',
    'Documento', 'Estado (Usuario)','EMAIL'
  ]
  const workspaceCriteria = await exports.getWorkspaceCriteria(workspaceId,criteria_id)
  workspaceCriteria.forEach(el => headers.push(el.name))
  return headers
}
exports.getGenericHeaders = async (workspaceId,criteria_id=[]) => {
  const headers = [
    'Nombre', 'Apellido Paterno', 'Apellido Materno',
    'Documento', 'Estado (Usuario)'
  ]
  const workspaceCriteria = await exports.getWorkspaceCriteria(workspaceId,criteria_id)
  workspaceCriteria.forEach(el => headers.push(el.name))
  return headers
}

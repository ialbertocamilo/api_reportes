const { con } = require('../db')
const { logtime, pluck } = require('./Helper')

exports.getWorkspaceCriteria = async (workspaceId, criteria_id=[]) => {
  logtime('method: getWorkspaceCriteria')

  let query = `
        select 
            c.*
        from 
            criteria c 
                left join criterion_workspace cw on c.id = cw.criterion_id
                left join workspaces w on w.id = cw.workspace_id
        where 
            w.id = :workspaceId 
            and (
                    cw.available_in_reports = 1
                    ${criteria_id.length > 0 ? ` or c.id in (${criteria_id.toString()}) ` : ''}
            )
            and w.active = 1 
            and c.active = 1
        group by c.id
        order by c.position
    `
  // logtime(query)

  const [rows] = await con.raw(query, { workspaceId })

  return rows
}

exports.loadWorkspaceSegmentationCriteria = async (workspaceId) => {
  // Load workspace's courses ids

  const query = `
    select distinct course_id
    from course_workspace
    where workspace_id = :workspaceId
  `
  const [_coursesIds] = await con.raw(query, { workspaceId })
  const courseIds = pluck(_coursesIds, 'course_id')

  // Load criteria ids used in workspace
  const query2 = `
    select
        c.id, c.name, c.code
    from
        segments s
            join segments_values sv on s.id = sv.segment_id
            join criteria c on c.id = sv.criterion_id
    where
        s.model_type = 'App\\\\Models\\\\Course'
        and s.active = 1
        and c.active = 1
        and s.deleted_at is null
        and c.deleted_at is null
        and s.model_id in (${courseIds.join()})
    group by
        criterion_id
    order by
        criterion_id
  `
  if (courseIds.length === 0) {
    return []
  } else {
    const [criterion] = await con.raw(query2)
    return criterion
  }
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

exports.getGenericHeadersByCriterioCodes = async (workspaceId, codes = '') => {
  const headers = [
    'Nombre', 'Apellido Paterno', 'Apellido Materno',
    'Documento', 'Estado (Usuario)'
  ];
  const workspaceCriteria = await exports.getWorkspaceCriteriaByCodes(workspaceId, codes);
  workspaceCriteria.forEach(el => headers.push(el.name));
  return headers;
}


exports.getWorkspaceCriteriaByCodes = async (workspaceId, codes = '') => {
  logtime('method: getWorkspaceCriteriaByCodes');

  let query = `
        select 
            c.*
        from 
            criteria c 
                inner join criterion_workspace cw on c.id = cw.criterion_id
                inner join workspaces w on w.id = cw.workspace_id
        where 
            w.id = :workspaceId and 
            ${codes.length > 0 ? ` c.code in (${codes}) and ` : ''}
            c.show_in_reports = 1 and
            w.active = 1 and
            c.active = 1
        group by c.id
    `
  // logtime(query)

  const [rows] = await con.raw(query, { workspaceId })

  return rows
}


exports.getCriterioValuesByCriterioId = async (criterioId) => {

  let query = `select cv.* from criterion_values cv where cv.criterion_id = :criterioId`;
  const [rows] = await con.raw(query, { criterioId })
  return rows
}

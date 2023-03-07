process.on('message', (requestData) => {
  executeReport(requestData)
})

const { createHeaders, worksheet, workbook, createAt } = require('../exceljs')
const { con } = require('../db')
const { loadWorkspaceSegmentationCriteria } = require('../helper/Criterios')
const { pluck } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { response } = require('../response')

const headers = [
  'Id usuario'
]

async function executeReport ({ workspaceId }) {
  // Generate Excel reports

  await createHeaders(headers)

  // Find those users who have no complete set of criteria

  const segmentationCriteria = await loadWorkspaceSegmentationCriteria(workspaceId)
  const segmentationCriteriaIds = pluck(segmentationCriteria, 'id')
  const users = await findUsersWithIncompleteCriteriaValues(workspaceId, segmentationCriteriaIds)

  // Add users to Excel rows

  for (const user of users) {
    const cellRow = []

    cellRow.push(user.user_id)

    // Add row to sheet

    worksheet.addRow(cellRow).commit()
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: '-' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Find those users who have no complete set of criteria
 */
async function findUsersWithIncompleteCriteriaValues (workspaceId, criteriaIds) {
  const subworkspacesIds = await getSuboworkspacesIds(workspaceId)
  const query = `
    select
        user_id,
        sum(criteria_count) total_criteria_count
    from (
        select
            u.id user_id,
            -- when a user has the same criterion with
            -- different values, only counts as one
            if (count(cv.criterion_id) >= 1, 1, 0) criteria_count
        from
            users u
            join criterion_value_user cvu on u.id = cvu.user_id
            join criterion_values cv on cv.id = cvu.criterion_value_id
        where
            u.active = 1
            and cv.active = 1
            and u.deleted_at is null
            and cv.deleted_at is null
            and u.subworkspace_id in (${subworkspacesIds.join()})
            and cv.criterion_id in (${criteriaIds.join()})
        group by
          u.id, cv.criterion_id
    ) user_criteria_count
    group by user_id
    having total_criteria_count < :criteriaCount
  `

  const [rows] = await con.raw(query, { criteriaCount: criteriaIds.length })
  return rows
}

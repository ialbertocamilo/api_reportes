process.on('message', (requestData) => {
  executeReport(requestData)
})

const { createHeaders, worksheet, workbook, createAt } = require('../exceljs')
const { con } = require('../db')
const { loadWorkspaceSegmentationCriteria } = require('../helper/Criterios')
const { pluck } = require('../helper/Helper')
const { response } = require('../response')

const headers = [
  'Nombre completo',
  'Documento de identidad'
]

async function executeReport ({ workspaceId, modules, selectedCriteria }) {

  // When criteria ids are not provided, load all
  // workspace criteria which is used in segmentation

  let segmentationCriteriaIds = []
  if (selectedCriteria.length) {
    segmentationCriteriaIds = selectedCriteria
  } else {
    const segmentationCriteria = await loadWorkspaceSegmentationCriteria(workspaceId)
    segmentationCriteriaIds = pluck(segmentationCriteria, 'id')
  }

  // Find those users who have no complete set of criteria

  const users = await findUsersWithIncompleteCriteriaValues(modules, segmentationCriteriaIds)

  // Generate Excel reports

  const criteriaNames = await getCriteriaNames(segmentationCriteriaIds)
  await createHeaders(headers.concat(criteriaNames))

  // Add users to Excel rows

  for (const user of users) {
    const cellRow = []

    cellRow.push(user.fullname)
    cellRow.push(user.document)

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
async function findUsersWithIncompleteCriteriaValues (subworkspacesIds, criteriaIds) {

  const query = `
    select
        user_id,
        fullname,
        document,
        sum(criteria_count) total_criteria_count
    from (
        select
            u.id user_id,
            concat(u.name, ' ', coalesce(u.lastname, '')) fullname,
            u.document,
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

/**
 * Load array of criteria names
 *
 * @param criteriaIds
 * @returns {Promise<*>}
 */
async function getCriteriaNames (criteriaIds) {
  const query = `select * from criteria where id in (${criteriaIds.join()})`
  const [rows] = await con.raw(query, { criteriaCount: criteriaIds.length })

  return pluck(rows, 'name')
}

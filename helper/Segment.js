const { con } = require('../db')
const { pluck } = require('./Helper')

/**
 * Extract criterion value ids from segment
 * values related to a supervisor
 *
 * @param supervisorId
 * @returns {Promise<void>}
 */
async function loadSupervisorSegmentCriterionValues (supervisorId) {
  // Load taxonomy for supervisors

  const [taxonomies] = await con.raw(`
    select * 
    from taxonomies
    where
        \`group\` = 'segment' and
        code = 'user-supervise' and
        type = 'code' and
        active = 1
  `)

  if (!taxonomies[0]) return []
  const supervisorTaxonomy = taxonomies[0]

  const query = `
    select 
      sv.*
    from
      segments s 
        inner join segments_values sv on s.id = sv.segment_id
    where
        s.model_id = :supervisorId and
        s.code_id = :supervisorTaxonomyId and
        s.active = 1 and
        sv.deleted_at is null
  `
  const [segmentValues] = await con.raw(
    query,
    {
      supervisorId,
      supervisorTaxonomyId: supervisorTaxonomy.id
    })

  return segmentValues
}

exports.loadSupervisorSegmentUsersIds = async (modulos, supervisorId) => {
  const criterionValues = await loadSupervisorSegmentCriterionValues(supervisorId)

  if (criterionValues.length === 0) return []

  // Generate conditions

  let criterionIds = []
  let previousCriterionId = null
  let WHERE = []
  criterionValues.forEach(value => {
    const criterionId = value.criterion_id

    let criterionValuesIds
    if (criterionId !== previousCriterionId) {
      if (!criterionIds.includes(criterionId)) {
        criterionIds.push(criterionId)
      }
      previousCriterionId = criterionId

      criterionValuesIds = criterionValues.filter(cv => cv.criterion_id === criterionId)
      criterionValuesIds = pluck(criterionValuesIds, 'criterion_value_id')

      if (criterionValuesIds.length > 0) {
        WHERE.push(`(
          scv.criterion_id = ${criterionId} and
          scv.criterion_value_id in (${criterionValuesIds.join()})
        )`)
      }
    }
  })

  // When no condition was generated, stop method execution

  if (WHERE.length === 0) return []

  WHERE = WHERE.join(' or ')
  const criterionCount = criterionIds.length
  criterionIds = criterionIds.join()

  const query = `
      select
        user_id
      from (
          -- Users' criterion values
        select
            cvu.user_id,
            cvu.criterion_value_id,
            cv.criterion_id
        from
        criterion_value_user cvu
        inner join criterion_values cv on cv.id = cvu.criterion_value_id
        inner join users u on u.id = cvu.user_id
        
        where 
            cv.criterion_id in (${criterionIds}) and
            u.subworkspace_id in (${modulos.join()})
      ) scv
      where
        ${WHERE}

      group by
        user_id
      
      having count(user_id) = ${criterionCount}
  `
  const [rows] = await con.raw(query)

  return pluck(rows, 'user_id')
}

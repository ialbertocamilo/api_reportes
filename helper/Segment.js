const { con } = require('../db')
const { pluck } = require('./Helper')

/**
 * Extract criterion value ids from segment
 * values related to a supervisor
 *
 * @param supervisorId
 * @returns {Promise<void>}
 */
exports.loadSupervisorSegmentCriterionValuesIds = async (supervisorId) => {
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
        s.active = 1
  `
  const [segmentValues] = await con.raw(
    query,
    {
      supervisorId,
      supervisorTaxonomyId: supervisorTaxonomy.id
    })

  return pluck(segmentValues, 'criterion_value_id')
}

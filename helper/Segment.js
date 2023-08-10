const { con } = require('../db')
const { pluck,uniqueElements,groupArrayOfObjects,pluckUnique } = require('./Helper')
const moment = require("moment");
/**
 * Extract criterion value ids from segment
 * values related to a supervisor
 *
 * @param supervisorId
 * @returns {Promise<void>}
 */
exports.loadUsersByResource = async ({modulos,model_type, model_id,select_users='users.id',type='only_id'}) => {
  const segments = await loadSegmentsByModel(model_type, model_id);
  
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  
  let users = [];
  for (segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${index > 0 ? "or" : ""
            } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
            }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });
    const [rows] =
      await con.raw(`select ${select_users} from users
        ${join_criterions_values_user}
        where users.active=1
        and users.subworkspace_id in (${modulos.join()})
        and users.deleted_at is null`);
    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  if(type == 'only_id'){
    return pluck(uniqueElements(users, "id"),'id');
  }
  return uniqueElements(users, "id");
}
async function loadSegmentsByModel(model_type='App\\Models\\User',model_id){
  return await con("segments_values as sv")
  .select(
    "sv.criterion_id",
    "sv.starts_at",
    "sv.finishes_at",
    "sv.segment_id",
    "sv.criterion_value_id",
    "t.code"
  )
  .join("segments as sg", "sg.id", "sv.segment_id")
  .join("criteria as c", "c.id", "sv.criterion_id")
  .join("taxonomies as t", "t.id", "c.field_id")
  .where("sg.model_type", model_type)
  .where("sg.model_id", model_id)
  .where("sg.deleted_at", null)
  .where("sv.deleted_at", null);
}
async function loadSupervisorSegmentCriterionValues (supervisorId) {
  // Load taxonomy for supervisors

  const [taxonomies] = await con.raw(`
    select *
    from taxonomies
    where
        \`group\` = 'segment' and
        code = 'user-supervise' and
        type = 'code' and
        active = 1 and
        deleted_at is null
  `)

  if (!taxonomies[0]) return []
  const supervisorTaxonomy = taxonomies[0]
  return await con("segments_values as sv")
  .select(
    "sv.criterion_id",
    "sv.starts_at",
    "sv.finishes_at",
    "sv.segment_id",
    "sv.criterion_value_id",
    "t.code"
  )
  .join("segments as sg", "sg.id", "sv.segment_id")
  .join("criteria as c", "c.id", "sv.criterion_id")
  .join("taxonomies as t", "t.id", "c.field_id")
  .where("sg.model_type", "App\\Models\\User")
  .where("sg.model_id", supervisorId)
  .where("sg.code_id", supervisorTaxonomy.id)
  .where("sg.deleted_at", null)
  .where("sv.deleted_at", null);
  // const query = `
  //   select
  //     sv.*
  //   from
  //     segments s
  //       inner join segments_values sv on s.id = sv.segment_id
  //   where
  //       s.model_id = :supervisorId and
  //       s.code_id = :supervisorTaxonomyId and
  //       s.active = 1 and
  //       s.deleted_at is null and
  //       sv.deleted_at is null
  // `
  // const [segmentValues] = await con.raw(
  //   query,
  //   {
  //     supervisorId,
  //     supervisorTaxonomyId: supervisorTaxonomy.id
  //   })

  // return segmentValues
}

exports.loadSupervisorSegmentUsersIds = async (modulos, supervisorId) => {
  // const criterionValues = await loadSupervisorSegmentCriterionValues(supervisorId)
  const segments = await loadSupervisorSegmentCriterionValues(supervisorId);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  let users = [];
  for (segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${index > 0 ? "or" : ""
            } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
            }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });
    const [rows] =
      await con.raw(`select users.id from users
        ${join_criterions_values_user}
        where users.active=1
        and users.subworkspace_id in (${modulos.join()})
        and users.deleted_at is null`);
    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  return pluck(uniqueElements(users, "id"),'id');
  // return await loadUsersSegmented(supervisorId,);
  // if (criterionValues.length === 0) return []

  // // Generate conditions

  // let criterionIds = []
  // let previousCriterionId = null
  // let WHERE = []
  // criterionValues.forEach(value => {
  //   const criterionId = value.criterion_id

  //   let criterionValuesIds
  //   if (criterionId !== previousCriterionId) {
  //     if (!criterionIds.includes(criterionId)) {
  //       criterionIds.push(criterionId)
  //     }
  //     previousCriterionId = criterionId

  //     criterionValuesIds = criterionValues.filter(cv => cv.criterion_id === criterionId)
  //     criterionValuesIds = pluck(criterionValuesIds, 'criterion_value_id')

  //     // Remove empty values

  //     criterionValuesIds = criterionValuesIds.filter(i => !!i)

  //     // Add conditions

  //     if (criterionValuesIds.length > 0) {
  //       WHERE.push(`(
  //         scv.criterion_id = ${criterionId} and
  //         scv.criterion_value_id in (${criterionValuesIds.join()})
  //       )`)
  //     }
  //   }
  // })

  // // When no condition was generated, stop method execution

  // if (WHERE.length === 0) return []

  // WHERE = WHERE.join(' or ')
  // const criterionCount = criterionIds.length
  // criterionIds = criterionIds.join()

  // const query = `
  //     select
  //       user_id
  //     from (
  //         -- Users' criterion values
  //       select
  //           cvu.user_id,
  //           cvu.criterion_value_id,
  //           cv.criterion_id
  //       from
  //       criterion_value_user cvu
  //       inner join criterion_values cv on cv.id = cvu.criterion_value_id
  //       inner join users u on u.id = cvu.user_id

  //       where
  //           cv.criterion_id in (${criterionIds}) and
  //           u.subworkspace_id in (${modulos.join()})
  //     ) scv
  //     where
  //       ${WHERE}

  //     group by
  //       user_id

  //     having count(user_id) = ${criterionCount}
  // `
  // const [rows] = await con.raw(query)

  // return pluck(rows, 'user_id')
}

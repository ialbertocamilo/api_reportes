const { con } = require('../db')
const {
    addActiveUsersCondition,
} = require('../helper/Usuarios')
async function loadUsersCheckists(
    modulos, checklistId, courseId, schoolId, activeUsers, inactiveUsers, start, end, areas, userIdsSegmentedToChecklist
) {
    let query = `SELECT
    if(ca.checklist_id is null, 1, 0) needs_override,
    u.subworkspace_id,
    u.id,
    u.name,
    u.lastname,
    u.surname,
    u.document,
    u.active,
    c.name course_name,
    checklists.title checklists_title,
    checklists.id checklist_id,
    tx.name as type_checklist,
    trainers.document as trainer_document,
    CONCAT_WS(' ', trainers.name, trainers.lastname, trainers.surname) trainer_name,
    ifnull(suc.completed, 0) as completed_checklists,
    ifnull(suc.assigned , 0) as assigned_checklists,
    ifnull(suc.advanced_percentage , 0) as progress,
    cli.activity,
    cli.type_id checklist_item_type,
    cai.qualification,
    ca.id checklist_answers_id,
    ca.updated_at checklist_answer_created_at
from
  trainer_user tu
inner join users u on
  u.id = tu.user_id
inner join users trainers on
  trainers.id = tu.trainer_id
left join checklist_answers ca ON ca.checklist_id  = ${checklistId} AND ca.student_id=u.id
left join checklists on
  ca.checklist_id = checklists.id
left join taxonomies tx on
  tx.id = checklists.type_id
left JOIN summary_user_checklist suc on
  suc.user_id = u.id
left join checklist_answers_items cai on
  ca.id = cai.checklist_answer_id
left join checklist_items cli on
cli.id = cai.checklist_item_id 
left join checklist_relationships cr on
  cr.checklist_id = ca.checklist_id
left join courses c on
  c.id = cr.course_id
`;
    //a checklist could be associated with one or more courses
    let staticCondition = ` where u.id in (${userIdsSegmentedToChecklist.toString()}) and cli.deleted_at is null and tu.active=1 `
    // ca.school_id in (${schoolId}) and
    // cr.course_id in (${courseId}) and
    if (areas.length > 0) {
        query += ` inner join criterion_value_user cvu on cvu.user_id = u.id
             inner join criterion_values cv on cvu.criterion_value_id = cv.id`
        query += staticCondition
        query += ' and ( cvu.criterion_value_id in ( '
        areas.forEach(cv => query += `${cv},`)
        query = query.slice(0, -1)
        query += ') '
        query += ') '
    } else {
        query += staticCondition;
    }
    // Add user conditions and group sentence
    query = addActiveUsersCondition(query, activeUsers, inactiveUsers)
    // Add dates conditions
    if (start && end) {
        query += ` and (
    suc.updated_at between '${start} 00:00' and '${end} 23:59'
  )`
    }
    // Add group sentence

    query += ' group by u.id ,cai.checklist_item_id'
    // Execute query
    // logtime(query);
    let [rows] = await con.raw(query, {})

    // Fill empty cells with checklist data

    const activities = await loadChecklistData(
        Array.isArray(checklistId) ? checklistId : [checklistId]
    )

    // Set checklist data for users without ans
    let newItems = [];
    rows = rows.map((r) => {

        if (r.needs_override) {
            activities.forEach(activity => {
                let new_item = {};
                Object.assign(new_item, r);
                new_item.checklists_title = activity.checklist_title
                new_item.type_checklist = activity.type_checklist
                new_item.course_name = activity.course_name
                new_item.activity = activity.name
                new_item.progress = 0
                new_item.checklist_item_type = activity.checklist_item_type
                new_item.qualification = 'Por validar'
                newItems.push(new_item);
            });
            return null
        }
        return r
    }).filter((element) => element !== null);

    return rows.concat(newItems)
}
async function loadChecklistData(checklistsIds) {
    const query = `
        select checkl.id checklist_id,
            checkl.title checklist_title,
            tx.name type_checklist,
            c.name course_name ,
            ci.activity as name,
            ci.type_id checklist_item_type
        from checklists checkl
            join taxonomies tx on tx.id = checkl.type_id
            left join checklist_relationships cr on cr.checklist_id = checkl.id
            left join courses c on c.id = cr.course_id  
            left JOIN checklist_items ci on ci.checklist_id =checkl.id
        where checkl.id in (${checklistsIds.join(',')}) and ci.active=1 and ci.deleted_at is null order by ci.position asc
    `
    const [rows] = await con.raw(query, {})
    return rows
}

exports.loadUsersCheckists = loadUsersCheckists


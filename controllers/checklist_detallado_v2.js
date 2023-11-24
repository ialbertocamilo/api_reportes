process.on('message', requestData => {
    generateReport(requestData)
  })
  
  const { con } = require('../db')
  const { worksheet, workbook, createAt, createHeaders } = require('../exceljs')
  const { response } = require('../response')
  const { getSuboworkspacesIds } = require('../helper/Workspace')
  const { getGenericHeadersV2, getWorkspaceCriteria } = require('../helper/Criterios')
  const { pluck, formatDatetimeToString } = require('../helper/Helper')
  const {
    getUserCriterionValues2, loadUsersCriteriaValues, addActiveUsersCondition,
    loadUsersBySubWorspaceIds
  } = require('../helper/Usuarios')
  const { loadSegments, loadUsersSegmentsCriterionValues, userMatchesSegments } = require('../helper/SegmentationHelper_v2')
  
  // Headers for Excel file
  
  const headersDefault = [
    'Documento (entrenador)',
    'Nombre (entrenador)',
    'Curso(s) Asignado',
    'Tipo Checklist',
    'Checklist',
    'Cumplimiento del Checklist',
    'Actividad',
    'A quien califica',
    'Estado',
    'Fecha y hora'
  ]
  
  async function generateReport ({
    workspaceId, checklist, curso, escuela, modulos,
    UsuariosActivos, UsuariosInactivos, start, end, areas
  }) {
    // Generate Excel file header
  
    const [headersEstaticos,workspaceCriteria] = await getGenericHeadersV2({workspaceId,headersDefault})
    // Load workspace criteria
  
    // const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
    const workspaceCriteriaNames = pluck(workspaceCriteria.filter(c=>c.code != 'module'), 'name');
    // When no modules are provided, get its ids using its parent id
  
    const subworkspaces = await getSuboworkspacesIds(workspaceId,'all')
    const subworkspaces_id = pluck(subworkspaces,'id')

    await createHeaders(headersEstaticos)
    const [checklistTypesTaxonomies] = await con.raw(`
      select id, name 
      from taxonomies 
      where \`group\` = 'checklist' and \`type\` = 'type'`)
    // Load users from database and generate ids array
    let checklistIds = Array.isArray(checklist) ? checklist : [checklist];
    let StackUserCriterios = [];
    for (const checklistId of checklistIds) {
        let userIdsSegmentedToChecklist = await loadUserIdsForChecklist ([checklistId], subworkspaces_id)
        const users = await loadUsersCheckists(
            subworkspaces_id, checklistId, curso, escuela, UsuariosActivos, UsuariosInactivos, start, end, areas, userIdsSegmentedToChecklist
        )
        // const usersIds = pluck(users, 'id')
        // const usersCriterionValues = await loadUsersCriteriaValues(subworkspaces_id, usersIds,false)
        
        for (const user of users) {
            const cellRow = []
            const subworkspace= subworkspaces.find(s => s.id == user.subworkspace_id);
            // Add default values
            cellRow.push(subworkspace.name || '-')
            cellRow.push(user.name)
            cellRow.push(user.lastname)
            cellRow.push(user.surname)
            cellRow.push(user.document)
            cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')
            // Add user's criterion values
            // const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues)
            if(StackUserCriterios[user.id]) {
                const StoreUserValues = StackUserCriterios[user.id];
                StoreUserValues.forEach((item) => cellRow.push(item.criterion_value || "-"));
              } else {
                const userValues = await getUserCriterionValues2(user.id, workspaceCriteriaNames);
                userValues.forEach((item) => cellRow.push(item.criterion_value || "-"));
                StackUserCriterios[user.id] = userValues; 
              }
            // userValues.filter(uv => uv.criterion_name != 'Módulo').forEach(item => cellRow.push(item.criterion_value || '-'))
            cellRow.push(user.trainer_document)
            cellRow.push(user.trainer_name)
            // cellRow.push(user.school_name)
            cellRow.push(user.course_name || '-')
            cellRow.push(user.type_checklist)
            cellRow.push(user.checklists_title)
            cellRow.push(user.progress)
            cellRow.push(user.activity)
            cellRow.push(getChecklistTypeName(user.checklist_item_type, checklistTypesTaxonomies))
            cellRow.push(user.qualification)
            cellRow.push(formatDatetimeToString(user.checklist_answer_created_at))
            worksheet.addRow(cellRow).commit()
        }
    }

    // const usersIds = pluck(users, 'id')
    // Load workspace user criteria
  
    // const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)
  
    // Load checklist activities
  
    // const checklistActivities = await loadChecklistActivities(checklist)
    // const activitiesHeaders = pluckUnique(checklistActivities, 'activity')
    // activitiesHeaders.forEach(h => headers.push(h))
  
    // Add headers
  
  
    // Load qualifiers from taxonomies
  
    
  
    // Add data to Excel rows
  
    
  
    if (worksheet._rowZero > 1) {
      workbook.commit().then(() => {
        process.send(response({ createAt, modulo: 'checklist_detallado' }))
      })
    } else {
      process.send({ alert: 'No se encontraron resultados' })
    }
  }

  async function loadUsersCheckists (
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
    let staticCondition = ` where u.id in (${userIdsSegmentedToChecklist.toString()}) and cli.deleted_at is null  `
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
    console.log(query);
    // Execute query
    // logtime(query);
    let [rows] = await con.raw(query, { })
  
    // Fill empty cells with checklist data
  
    const activities = await loadChecklistData(
      Array.isArray(checklistId) ? checklistId : [checklistId]
    )
  
    // Set checklist data for users without ans
    let newItems = [];
    rows = rows.map((r) => {
        
        if(r.needs_override){
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
  

  function getChecklistTypeName (id, checklistTypesTaxonomies) {
    const type = checklistTypesTaxonomies.find(tx => tx.id === id)
    return type ? type.name : null
  }
  
  /**
   * Load ids of users segmented to checklist
   */
  async function loadUserIdsForChecklist (checklistIds, modulos) {
  
    const segments = await loadSegments(
      "App\\Models\\Checklist", checklistIds
    );
    const moduleUsers = await loadUsersBySubWorspaceIds(modulos);
    const usersIds = pluck(moduleUsers, 'id');
    const segmentsUsersCriterionValues = await loadUsersSegmentsCriterionValues(segments, usersIds)
  
    // Check if module users match checklist segment
  
    let checklistUsersIds = []
    usersIds.forEach(userId => {
  
      let matchesSegmentsIds = userMatchesSegments(userId, segments, segmentsUsersCriterionValues.filter(u => +u.user_id === +userId))
  
      if (matchesSegmentsIds.length) {
        checklistUsersIds.push(userId)
      }
    })
  
    return checklistUsersIds
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
    const [rows] = await con.raw(query, { })
    return rows
  }
  
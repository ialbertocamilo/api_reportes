process.on('message', requestData => {
    generateReport(requestData)
  })
  
  const { con } = require('../db')
  const { worksheet, workbook, createAt, createHeaders } = require('../exceljs')
  const { response } = require('../response')
  const { getSuboworkspacesIds } = require('../helper/Workspace')
  const { getGenericHeadersV2, getWorkspaceCriteria } = require('../helper/Criterios')
  const { pluck, formatDatetimeToString } = require('../helper/Helper')
  const {loadUsersCheckists} = require('../helper/Checklist');
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
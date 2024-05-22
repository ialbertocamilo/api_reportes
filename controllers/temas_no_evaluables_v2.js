'use strict'
process.on('message', req => {
  exportTemasNoEvaluables(req)
})

const { con } = require('../db')

const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { createHeaders, worksheet, workbook, createAt } = require('../exceljs')
const { pluck, logtime, groupArrayOfObjects } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { getUserCriterionValues, 
        loadUsersCriteriaValues,
        loadUsersBySubWorspaceIds,
        getUsersNullAndNotNull, 
        getUserCriterionValues2,
        addActiveUsersCondition } = require('../helper/Usuarios')
const { response } = require('../response')

const { loadCoursesV2, 
        loadUsersSegmentedv2WithSummaryTopicsNoEva } 
        = require('../helper/SegmentationHelper_v2')
        // = require('../helper/SegmentationHelper')
const { loadTopicsStatuses, 
        loadTopicsByCoursesIds,
        loadCompatiblesId,
        getTopicStatusName,
        loadModalities,
        loadAssistances, } = require('../helper/CoursesTopicsHelper')
const { loadSummaryCoursesByUsersAndCoursesTopics } = require('../helper/Summaries')

const headers = [
  'TIPO DE CURSO',
  'ESCUELA',
  'MODALIDAD',
  'CURSO',
  'TEMA',
  'TIPO TEMA',
  'RESULTADO TEMA', // convalidado
  'ESTADO(TEMA)',
  'CANTIDAD DE VISITAS POR TEMA',
  'CURSO COMPATIBLE' // nombre del curso
]

async function exportTemasNoEvaluables ({
  modulos = [], 
  workspaceId, 
  modality_id,
  cursos, 
  escuelas, 
  areas,
  temas,

  tipocurso,

  CursosActivos = false, CursosInactivos = false,
  UsuariosActivos, UsuariosInactivos,

  activeTopics, 
  inactiveTopics, 

  start, end,
  completed = true
}) {
  // Generar cabeceras de excel
  const modalities = await loadModalities();
  const modality_course_code = modalities.find((m) => m.id == modality_id).code
  if(modality_course_code == 'in-person'){
    const index = headers.indexOf('TIPO TEMA') + 1;
    headers.splice(index, 0,'ASISTENCIA');
    headers.splice(index+1, 0,'FECHA DE ASISTENCIA');
  }
  if(modality_course_code == 'virtual'){
    const index = headers.indexOf('TIPO TEMA') + 1;
    headers.splice(index, 0,'PRIMERA ASISTENCIA');
    headers.splice(index+1, 0,'SEGUNDA ASISTENCIA');
    headers.splice(index+2, 0,'TERCERA ASISTENCIA');
    headers.splice(index+3, 0,'MINUTOS EN REUNION');
    headers.splice(index+4, 0,'PRESENCIA EN REUNION ');
  }
  const headersEstaticos = await getGenericHeaders(workspaceId);
  await createHeaders(headersEstaticos.concat(headers));

  // Cargar criterios segun workspace
  const workspaceCriteria = await getWorkspaceCriteria(workspaceId);
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name');

  // cargar modulos
  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load user topic statuses
  const userTopicsStatuses = await loadTopicsStatuses();

  let users_to_export = [];

  const courses = await loadCoursesV2({
      escuelas, cursos, temas,
      CursosActivos, CursosInactivos,
      tipocurso
  }, workspaceId);

  // === precargar topics, usuarios y criterios ===
  let StackTopicsData = {};
  if(courses.length) {
    StackTopicsData = await loadTopicsByCoursesIds( 
                            pluck(courses, 'course_id'), true);
  }
  const StackUsersData = await loadUsersBySubWorspaceIds(modulos, true);
  let StackUserCriterios = [];
  // === precargar topics, usuarios y criterios ===

  for (const course of courses) {
    logtime(`CURRENT COURSE: ${course.course_id} - ${course.course_name}`);

    // datos de usuario - temas
    logtime(`-- start: user segmentation --`);
    const users = await loadUsersSegmentedv2WithSummaryTopicsNoEva(
      course.course_id, 
      modulos, 
      areas,
      temas,

      start, 
      end, 

      UsuariosActivos, 
      UsuariosInactivos,

      activeTopics,
      inactiveTopics,

      completed
    );
    logtime(`-- end: user segmentation --`);

    const { users_null, users_not_null } = getUsersNullAndNotNull(users);
    console.log( 'total rows', users.length, 
                              { users_null: users_null.length,
                                users_not_null: users_not_null.length });

    // agrupa usuarios por id
    const users_topics_grouped = groupArrayOfObjects(users_null, 'id'); 
    users_to_export = users_not_null;

    // obtener cursos compatibles segun 'course_id'
    const compatibles_courses = await loadCompatiblesId(course.course_id);
    const pluck_compatibles_courses = pluck(compatibles_courses, "id");

    if (compatibles_courses.length > 0 && users_null.length > 0) {
      logtime(`INICIO COMPATIBLES`);

      const stack_ids_users = Object.keys(users_topics_grouped);

      // summary_topics verifica si es compatible
      const st_compatibles = await loadSummaryCoursesByUsersAndCoursesTopics(
        stack_ids_users,
        pluck_compatibles_courses
      );

      for(const index of stack_ids_users) {
        const CurrentUser = users_topics_grouped[index];

        if(CurrentUser[0].sc_created_at) {
          CurrentUser.forEach((item) => users_to_export.push(item)); // usertopics          
          continue;
        }

        //verificar compatible con 'user_id' y 'course_id'
        const st_compatible = st_compatibles.filter((row) => {
          return row.user_id == index && pluck_compatibles_courses.includes(row.course_id);
        }).sort()[0]; 

        if(!st_compatible) {
          CurrentUser.forEach((item) => users_to_export.push(item)); // usertopics          
          continue;
        }
        
        CurrentUser.forEach((item) => {
          const additionalData = {
                                  topic_status_name: 'Convalidado',
                                  compatible: st_compatible.course_name 
                                 };

          users_to_export.push({...item, ...additionalData }); // usertopics
        });      
      }
      logtime(`FIN COMPATIBLES`);
    } else {
      users_to_export = [...users_not_null, ...users_null];
    }
    let assistances=[];
    if(modality_course_code == 'in-person'){
      assistances = await loadAssistances(course.course_id);
    }
    if(modality_course_code == 'virtual'){
      assistances = await loadAssistances(course.course_id,'virtual');
    }
    // recorrido para exportar
    for (const user of users_to_export) { 

      const cellRow = []

      // encontrar usuario por 'id'
      const { id } = user;
      // console.log('user',user);
      const userStore = StackUsersData[id];
      cellRow.push(userStore.name)
      cellRow.push(userStore.lastname)
      cellRow.push(userStore.surname)
      cellRow.push(userStore.document)
      cellRow.push(userStore.active === 1 ? 'Activo' : 'Inactivo')
      if (process.env.MARCA === 'claro') { cellRow.push(userStore.phone_number) }
      // encontrar usuario por 'id'

      // criterios de usuario
      if(StackUserCriterios[id]) {
        const StoreUserValues = StackUserCriterios[id];
        StoreUserValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

      } else {
        const userValues = await getUserCriterionValues2(user.id, workspaceCriteriaNames);
        userValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

        StackUserCriterios[id] = userValues; 
      }
      // criterios de usuario

      cellRow.push(course.course_type || '-')
      cellRow.push(course.school_name)
      const modality = modalities.find(m => m.id == course.modality_id);
      cellRow.push(modality ? modality.name : '-');
      cellRow.push(course.course_name)

      // encontrar topic por 'id'
      const { topic_id } = user;
      const topicStore = StackTopicsData[topic_id];

      cellRow.push(topicStore.topic_name) // topicStore
      cellRow.push(topicStore.topic_assessable ? 'Evaluable' : 'No evaluable' ) // topicStore
      //ASSISTANCE INFO ONLY FOR SESSIONS IN PERSON
      if(modality_course_code == 'in-person'){
        const user_assistance = assistances.find( (a) => a.topic_id == topicStore.id && a.user_id == user.id);
        cellRow.push(user_assistance ? user_assistance.status_name : 'No asistió')
        cellRow.push(user_assistance ? user_assistance.date_assistance : '-')
      }
      if(modality_course_code == 'virtual'){
        const user_assistance = assistances.find( (a) => a.topic_id == topicStore.id && a.user_id == user.id);
        cellRow.push(user_assistance ? user_assistance.present_at_first_call : '-')
        cellRow.push(user_assistance ? user_assistance.present_at_middle_call : '-')
        cellRow.push(user_assistance ? user_assistance.present_at_last_call : '-')
        cellRow.push(user_assistance ? user_assistance.total_duration : '-')
        cellRow.push(user_assistance ? user_assistance.presence_in_meeting+' %' : '-')

      }
      // estado para - 'RESULTADO DE TEMA'
      if(!user.topic_status_name) {
        cellRow.push(getTopicStatusName(userTopicsStatuses, user.topic_status_id) || 'No iniciado')
      }else{
        cellRow.push(user.topic_status_name)
      }
      cellRow.push(topicStore.topic_active === 1 ? 'ACTIVO' : 'INACTIVO') // topicStore
      cellRow.push(user.topic_views || '-')
      cellRow.push(user.compatible || `-`)
      
      // añadir fila 
      worksheet.addRow(cellRow).commit()
    }
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Temas no evaluables' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

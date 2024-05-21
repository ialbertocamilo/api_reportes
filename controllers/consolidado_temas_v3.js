'use strict'
process.on('message', (requestData) => {
  exportarUsuariosDW(requestData)
})

require('../error')
const _ = require('lodash')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getGenericHeadersV2, getWorkspaceCriteria } = require('../helper/Criterios')
const moment = require('moment')
const { con } = require('../db')
const { pluck, logtime, groupArrayOfObjects,setCustomIndexAtObject,
  getDurationInSeconds
} = require('../helper/Helper')
const { loadUsersCriteriaValues, 
        getUserCriterionValues,
        getUsersNullAndNotNull,
        getUserCriterionValues2, 
        loadUsersBySubWorspaceIds,
        addActiveUsersCondition } = require('../helper/Usuarios')
const {
  loadTopicsStatuses, getTopicStatusId, getEvaluationTypeName,
  loadEvaluationTypes, getCourseStatusName, getTopicStatusName,
  loadCoursesStatuses,
  loadCompatiblesId,
  loadTopicsByCourseId,
  loadTopicsByCoursesIds,
  loadTopicQualificationTypes,
  getTopicCourseGrade,
  loadTopicsByCourseUniqueId,
  loadModalities,
  loadAssistances,
  getTotalDurationPercentInMeeting,
} = require('../helper/CoursesTopicsHelper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { loadCoursesV2, 
        loadUsersSegmentedv2, 
        loadUsersSegmentedWithSummariesTopics, 
        loadUsersSegmentedv2WithSummaryTopics } 
        = require('../helper/SegmentationHelper_v2')
        // = require('../helper/SegmentationHelper')
const { loadSummaryCoursesByUsersAndCoursesTopics } = require('../helper/Summaries')

moment.locale('es')

let headersDefault = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'MODALIDAD',
  'CURSO',
  'RESULTADO CURSO',
  'REINICIOS CURSO',
  'TIPO CURSO',
  'TEMA',
  'RESULTADO TEMA', // convalidado
  'ESTADO TEMA',
  'SISTEMA DE CALIFICACIÓN', // tipo calificacion
  'NOTA TEMA',
  'REINICIOS TEMA',
  'INTENTOS',
  'INTENTOS TOTALES',
  'EVALUABLE TEMA',
  'TIPO TEMA',
  'VISITAS TEMA',
  'PJE. MINIMO APROBATORIO',
  'ULTIMA EVALUACIÓN (FECHA)',
  'ULTIMA EVALUACIÓN (HORA)',
  'CURSO COMPATIBLE' // nombre del curso
]

async function exportarUsuariosDW({
  workspaceId, modulos, 
  escuelas, modality_id,cursos, temas, areas,
  
  revisados, 
  aprobados, 
  desaprobados, 
  realizados, 
  porIniciar,
  tipocurso,

  CursosActivos = false, CursosInactivos = false,
  UsuariosActivos, UsuariosInactivos,
  activeTopics, inactiveTopics,

  start: start_date,
  end: end_date,
  completed = true,
  validador
}) {

  // Start benchmark

  logtime(`----> START Consolidado temas: ${workspaceId}`)
  const startTime = new Date();


  // Generate Excel file header
  const modalities = await loadModalities();
  const modality_course_code = modalities.find((m) => m.id == modality_id).code
  if(modality_course_code == 'in-person'){
    const index = headersDefault.indexOf('SISTEMA DE CALIFICACIÓN') + 1;
    headersDefault.splice(index, 0,'ASISTENCIA');
    headersDefault.splice(index+1, 0,'FECHA DE ASISTENCIA');
  }
  if(modality_course_code == 'virtual'){
    const index = headersDefault.indexOf('SISTEMA DE CALIFICACIÓN') + 1;
    headersDefault.splice(index, 0,'PRIMERA ASISTENCIA');
    headersDefault.splice(index+1, 0,'SEGUNDA ASISTENCIA');
    headersDefault.splice(index+2, 0,'TERCERA ASISTENCIA');
    headersDefault.splice(index+3, 0,'MINUTOS EN REUNION');
    headersDefault.splice(index+4, 0,'PRESENCIA EN REUNION ');
  }
  const [headersEstaticos,workspaceCriteria] = await getGenericHeadersV2({workspaceId,headersDefault})
  await createHeaders(headersEstaticos)

  if (validador) {
    headers = headers.concat([
      'VALIDADOR DE INTENTOS REINICIOS',
      'VALIDADOR PUNTAJE'
    ])
  }

  // Load workspace criteria

  const workspaceCriteriaNames = pluck(workspaceCriteria.filter(c=>c.code != 'module'), 'name');
  const subworkspaces = await getSuboworkspacesIds(workspaceId,'all')

  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load user topic statuses

  const userTopicsStatuses = await loadTopicsStatuses()

  // Load user course statuses

  const userCourseStatuses = await loadCoursesStatuses()

  // load qualification types

  let QualificationTypes = await loadTopicQualificationTypes();
      QualificationTypes = setCustomIndexAtObject(QualificationTypes);

  // Load evaluation types

  const evaluationTypes = await loadEvaluationTypes()

  let users_to_export = [];

  const courses = await loadCoursesV2({
      escuelas, cursos, temas, CursosActivos, CursosInactivos, tipocurso
    }, workspaceId);

  // === filtro de checks === 
  const StateChecks = (revisados && aprobados && desaprobados &&
                       realizados && porIniciar);
  let StackChecks = [];

  if (revisados) { StackChecks.push(getTopicStatusId(userTopicsStatuses, 'revisado'))  }
  if (aprobados) { StackChecks.push(getTopicStatusId(userTopicsStatuses, 'aprobado')) }
  if (desaprobados) { StackChecks.push(getTopicStatusId(userTopicsStatuses, 'desaprobado')) }
  if (realizados) { StackChecks.push(getTopicStatusId(userTopicsStatuses, 'realizado')) }
  if (porIniciar) { StackChecks.push(getTopicStatusId(userTopicsStatuses, 'por-iniciar')) }
  // ===filtro de checks ===

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
    const users = await loadUsersSegmentedv2WithSummaryTopics(
      course.course_id, 
      modulos, 
      areas,
      temas,

      start_date, 
      end_date, 

      UsuariosActivos, 
      UsuariosInactivos,

      activeTopics,
      inactiveTopics,

      completed
    );
    logtime(`-- end: user segmentation --`);

    const { users_null, users_not_null } = getUsersNullAndNotNull(users);
    console.log( 'total rows', { users_null: users_null.length,
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
          CurrentUser.forEach((item) => users_to_export.push(item));
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
                                  course_status_name: 'Convalidado', 
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
      
      // === filtro de checks === 
      if(!StateChecks && !StackChecks.includes(user.topic_status_id)) continue;

      const cellRow = []

      // encontrar usuario por 'id'
      const { id } = user;
      // console.log('user',user);
      const userStore = StackUsersData[id];
      if (!userStore) continue;

      const lastLogin = moment(userStore.last_login).format('DD/MM/YYYY H:mm:ss')
      const subworkspace= subworkspaces.find(s => s.id == userStore.subworkspace_id);

      // Add default values

      cellRow.push(subworkspace.name || '-')
      cellRow.push(userStore.name)
      cellRow.push(userStore.lastname)
      cellRow.push(userStore.surname)
      cellRow.push(userStore.document)
      cellRow.push(userStore.active === 1 ? 'Activo' : 'Inactivo')
      if (process.env.MARCA === 'inretail-test2') { cellRow.push(userStore.phone_number) }

      // User criteria

      if (StackUserCriterios[id]) {
        const StoreUserValues = StackUserCriterios[id];
        StoreUserValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

      } else {
        const userValues = await getUserCriterionValues2(user.id, workspaceCriteriaNames);
        userValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

        StackUserCriterios[id] = userValues;
      }

      cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')

      cellRow.push(course.school_name)
      const modality = modalities.find(m => m.id == course.modality_id);
      cellRow.push(modality ? modality.name : '-');
      
      cellRow.push(course.course_name)

      // Course status

      if(!user.course_status_name) {
        cellRow.push(getCourseStatusName(userCourseStatuses, user.course_status_id) || "No iniciado" );
      } else {
        cellRow.push(user.course_status_name);
      }

      cellRow.push(user.course_restarts || '-')
      cellRow.push(course.course_type || '-')

      // encontrar topic por 'id'
      const { topic_id } = user;
      const topicStore = StackTopicsData[topic_id];
      const qualification = QualificationTypes[topicStore.qualification_type_id];

      if (!topicStore) continue;

      cellRow.push(topicStore.topic_name) // topicStore

        if(!user.topic_status_name) {
          cellRow.push(getTopicStatusName(userTopicsStatuses, user.topic_status_id) || 'No iniciado')
        }else{
          cellRow.push(user.topic_status_name)
        }

      cellRow.push(topicStore .topic_active === 1 ? 'ACTIVO' : 'INACTIVO') // topicStore
      cellRow.push(qualification ? qualification.name : '-')
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
      cellRow.push(qualification ? getTopicCourseGrade(user.topic_grade, qualification.position) : '-')

      cellRow.push(user.topic_restarts || '-')
      cellRow.push(user.topic_attempts || '-')
      cellRow.push(user.topic_total_attempts || '-')
      cellRow.push(topicStore .topic_assessable ? 'Sí' : 'No') // topicStore

      cellRow.push(getEvaluationTypeName(evaluationTypes, topicStore.type_evaluation_id)) // topicStore

      cellRow.push(user.topic_views || '-')
      cellRow.push(qualification ? getTopicCourseGrade(user.minimum_grade, qualification.position) : '-') // minimum_grade
      cellRow.push(user.topic_last_time_evaluated_at ? moment(user.topic_last_time_evaluated_at).format('DD/MM/YYYY') : '-')
      cellRow.push(user.topic_last_time_evaluated_at ? moment(user.topic_last_time_evaluated_at).format('H:mm:ss') : '-')

      cellRow.push(user.compatible || `-`);
      

      worksheet.addRow(cellRow).commit()
    }
  }

  // Finish benchmark

  logtime(
    `----> END Consolidado temas: ${workspaceId} - ` +
    getDurationInSeconds(startTime, new Date())
  )

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoCompatibleTemas' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

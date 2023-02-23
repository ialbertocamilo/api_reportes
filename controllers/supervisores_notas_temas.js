'use strict'
process.on('message', (requestData) => {
  exportarUsuariosDW(requestData)
})

require('../error')
const _ = require('lodash')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const moment = require('moment')
const { con } = require('../db')
const { pluck, logtime, groupArrayOfObjects } = require('../helper/Helper')
const {
  getUsersNullAndNotNull,
  getUserCriterionValues2,
  loadUsersBySubWorspaceIds
} = require('../helper/Usuarios')
const {
  loadTopicsStatuses, getTopicStatusId, getEvaluationTypeName,
  loadEvaluationTypes, getCourseStatusName, getTopicStatusName,
  loadCoursesStatuses,
  loadCompatiblesId,
  loadTopicsByCoursesIds
} = require('../helper/CoursesTopicsHelper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { loadCoursesV2, loadUsersSegmentedv2WithSummaryTopics } = require('../helper/SegmentationHelper_v2')
const { loadSummaryCoursesByUsersAndCoursesTopics } = require('../helper/Summaries')
const { loadSupervisorSegmentUsersIds } = require('../helper/Segment')

moment.locale('es')

let headers = [
  'ULTIMA SESIÓN',
  'ESCUELA',
  'CURSO',
  'RESULTADO CURSO',
  'REINICIOS CURSO',
  'TIPO CURSO',
  'TEMA',
  'RESULTADO TEMA', // convalidado
  'ESTADO TEMA',
  'NOTA TEMA',
  'REINICIOS TEMA',
  'INTENTOS PRUEBA',
  'EVALUABLE TEMA',
  'TIPO TEMA',
  'VISITAS TEMA',
  'PJE. MINIMO APROBATORIO',
  'ULTIMA EVALUACIÓN',
  'CURSO COMPATIBLE' // nombre del curso
]

async function exportarUsuariosDW({
  workspaceId,
  escuelas,
  cursos,
  supervisorId,
  modulos = [],
  temas = [],
  areas = [],

  aprobados = true,
  desaprobados = true,
  UsuariosActivos = true,
  UsuariosInactivos = true,
  CursosActivos = true,
  CursosInactivos = true,

  activeTopics= true,
  inactiveTopics = true,
  tipocurso,
  revisados = true,
  realizados = true,
  porIniciar = true,
  completed = true
}) {
  // Generate Excel file header

  const headersEstaticos = await getGenericHeaders(workspaceId)
  await createHeaders(headersEstaticos.concat(headers))


  // Load modules from workspace

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  const supervisedUsersIds = await loadSupervisorSegmentUsersIds(modulos, supervisorId)

  // Load user topic statuses
  const userTopicsStatuses = await loadTopicsStatuses()

  // Load user course statuses
  const userCourseStatuses = await loadCoursesStatuses()

  // Load evaluation types
  const evaluationTypes = await loadEvaluationTypes()

  let users_to_export = [];

  const courses = await loadCoursesV2({
    escuelas, cursos, temas,
    CursosActivos, CursosInactivos,
    tipocurso
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

      null,
      null,

      UsuariosActivos,
      UsuariosInactivos,

      activeTopics,
      inactiveTopics,

      completed,
      supervisedUsersIds
    )
    logtime(`-- end: user segmentation --`)

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

    // recorrido para exportar
    for (const user of users_to_export) {

      // === filtro de checks ===
      if(!StateChecks && !StackChecks.includes(user.topic_status_id)) continue;

      const cellRow = []

      // encontrar usuario por 'id'
      const { id } = user;
      // console.log('user',user);
      const userStore = StackUsersData[id];
      const lastLogin = moment(userStore.last_login).format('DD/MM/YYYY H:mm:ss')
      cellRow.push(userStore.name)
      cellRow.push(userStore.lastname)
      cellRow.push(userStore.surname)
      cellRow.push(userStore.document)
      cellRow.push(userStore.active === 1 ? 'Activo' : 'Inactivo')
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

      cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')

      cellRow.push(course.school_name)
      cellRow.push(course.course_name)

      // estado para - 'RESULTADO DE CURSO'
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

      cellRow.push(topicStore.topic_name) // topicStore

      // estado para - 'RESULTADO DE TEMA'
      if(!user.topic_status_name) {
        cellRow.push(getTopicStatusName(userTopicsStatuses, user.topic_status_id) || 'No iniciado')
      }else{
        cellRow.push(user.topic_status_name)
      }

      cellRow.push(topicStore .topic_active === 1 ? 'ACTIVO' : 'INACTIVO') // topicStore

      cellRow.push(user.topic_grade || '-')
      cellRow.push(user.topic_restarts || '-')
      cellRow.push(user.topic_attempts || '-')
      cellRow.push(topicStore .topic_assessable ? 'Sí' : 'No') // topicStore

      cellRow.push(getEvaluationTypeName(evaluationTypes, topicStore.type_evaluation_id)) // topicStore

      cellRow.push(user.topic_views || '-')
      cellRow.push(user.minimum_grade || '-')
      cellRow.push(user.topic_last_time_evaluated_at ? moment(user.topic_last_time_evaluated_at).format('DD/MM/YYYY H:mm:ss') : '-')

      cellRow.push(user.compatible || `-`);

      // añadir fila
      worksheet.addRow(cellRow).commit()
    }
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoCompatibleTemas' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

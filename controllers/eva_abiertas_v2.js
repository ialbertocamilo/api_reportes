'use strict'
process.on('message', req => {
  exportarEvaluacionesAbiertas(req)
})
const moment = require('moment')
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
        loadUsersSegmentedv2WithSummaryTopicsEva } 
        = require('../helper/SegmentationHelper_v2')
        // = require('../helper/SegmentationHelper')
const { loadTopicsStatuses, 
        loadTopicsByCoursesIds,
        loadCompatiblesId,
        getTopicStatusName } = require('../helper/CoursesTopicsHelper')
const { loadSummaryCoursesByUsersAndCoursesTopics } = require('../helper/Summaries')
let headers = [
  'ÚLTIMA SESIÓN',
  'ESCUELA',
  'CURSO',
  'TIPO CURSO',
  'TEMA',
  'TIPO TEMA',
  'RESULTADO TEMA', // convalidado
  'CURSO COMPATIBLE' // nombre del curso
]

async function exportarEvaluacionesAbiertas ({
  modulos = [], 
  workspaceId,

  escuelas, 
  cursos, 
  temas, 
  areas, 

  tipocurso,

  CursosActivos = false, CursosInactivos = false,
  UsuariosActivos, UsuariosInactivos, 
  
  activeTopics = false, 
  inactiveTopics = false, 

  start, 
  end, 

  completed = true
}) {
  // Generate Excel file header
  const headersEstaticos = await getGenericHeaders(workspaceId)
  await createHeaders(headersEstaticos.concat(headers))

  // Load workspace criteria
  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // When no modules are provided, get its ids using its parent id
  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  const userTopicsStatuses = await loadTopicsStatuses();
  const questionsData = await loadQuestions(modulos);

  const groupedQuestionData = groupArrayOfObjects(questionsData, 'topic_id');

  // console.log('questionsData, groupedQuestionData:', { questionsData, groupedQuestionData});

  const { altHeaders, maxQuestions } = getCreatedHeaders(groupedQuestionData, headers);
  await createHeaders(headersEstaticos.concat(altHeaders));
  // console.log(questionsData);

  let users_to_export = [];

  const courses = await loadCoursesV2({
      escuelas, cursos, temas,
      CursosActivos, CursosInactivos,
      tipocurso
  }, workspaceId, false);

  // === precargar topics, usuarios y criterios ===
  const StackTopicsData = await loadTopicsByCoursesIds( 
                                pluck(courses, 'course_id'), true);
  const StackUsersData = await loadUsersBySubWorspaceIds(modulos, true);
  let StackUserCriterios = [];
  // === precargar topics, usuarios y criterios ===

  for (const course of courses) {
    logtime(`CURRENT COURSE: ${course.course_id} - ${course.course_name}`);

    // datos de usuario - temas
    logtime(`-- start: user segmentation --`);
    const users = await loadUsersSegmentedv2WithSummaryTopicsEva(
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

    // recorrido para exportar
    for (const user of users_to_export) { 

      const cellRow = []

      // encontrar usuario por 'id'
      const { id } = user;
      // console.log('user',user);
      const userStore = StackUsersData[id];
      const lastLogin = moment(userStore.last_login).format('DD/MM/YYYY H:mm:ss');
      
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
      cellRow.push(course.course_type || '-')

      // encontrar topic por 'id'
      const { topic_id } = user;
      const topicStore = StackTopicsData[topic_id];

      cellRow.push(topicStore.topic_name) // topicStore
      cellRow.push(topicStore.topic_assessable ? 'Evaluable' : 'No evaluable' ) // topicStore

      // estado para - 'RESULTADO DE TEMA'
      if(!user.topic_status_name) {
        cellRow.push(getTopicStatusName(userTopicsStatuses, user.topic_status_id) || 'No iniciado')
      }else{
        cellRow.push(user.topic_status_name)
      }

      cellRow.push(user.compatible || `-`);

      // === Questions Answers FP / Others ===
      const answers = user.answers;
      const countLimit = answers ? answers.length : 0;
        
      let answers_q_check = 0;

      if(countLimit) {
        const questions = questionsData.filter( ({topic_id: q_topic_id}) =>  q_topic_id === topic_id );
        
        if(questions.length) {
          answers_q_check = questions.length;

          answers.forEach((answer, index) => {
            if (answer) {
              const question = question.find((q) => q.id === answer.id);

              cellRow.push(question ? strippedString(question.pregunta) : '-');
              cellRow.push(answer ? strippedString(answer.respuesta) : '-');
            }
          });
        }

      }
      // === para rellenar en preguntas ===
      const emptyRows = (answers) ? maxQuestions - answers_q_check
                                  : maxQuestions;
                                  
      for (let i = 0; i < emptyRows; i++) {
        cellRow.push('-');
        cellRow.push('-');
      }
      // === para rellenar en preguntas ===

  /*  } else {
        // console.log('answers', answers);

        if (answers) {
          answers.forEach((answer, index) => {
            if (answer) {
              const question = questionsData.find(q => q.id === answer.id);
              cellRow.push((question) ? strippedString(question.pregunta) : '-')
              cellRow.push((answer && question) ? strippedString(answer.respuesta) : '-');
            }
          });
        }
      } */


    // añadir fila 
    worksheet.addRow(cellRow).commit();
    }
  }

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'EvaluacionAbierta' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }

}

const strippedString = (value) => {
  return value.replace(/(<([^>]+)>)/gi, '')
}

async function getQuestionsByTopic(topic_id, countLimit) {

  let query = `select q.* from questions q 
               where q.topic_id = ${topic_id} 
                     and q.type_id = 4567
               limit ${countLimit}`;

  // logtime(query);

  const [rows] = await con.raw(query);
  return rows;
}

function getCreatedHeaders(questions, headers){
  
  let maxQuestions = 0;

  for (const question in questions) {
    const result = questions[question];
    const countQuestions = result.length; 
    if(countQuestions > maxQuestions) maxQuestions = countQuestions;
  }

  // === CONDITIONAL HEADERS ===
  const MakeLoopColumns = (num, keys) => {
    let loopColumns = [];
    
    for (let i = 0; i < num; i++) {
      let stack = [];
      
      for(const val of keys) {
        let current = `${val} ${i + 1}`;        
        stack.push(current);
      }
      loopColumns.push(...stack); 
    }

    return loopColumns;
  };

  const StaticKeysColumns = ['Pregunta','Respuesta']; //cols loop
  
  if(maxQuestions > 1) {
    const conditionHeaders = MakeLoopColumns(maxQuestions, StaticKeysColumns);
    headers = [...headers, ...conditionHeaders];

  } else headers = [...headers, ...StaticKeysColumns]; 

  return { altHeaders: headers, maxQuestions };
  // === CONDITIONAL HEADERS ===
}

/**
 * Load questions with written answers
 * @param modulesIds
 * @returns {Promise<*>}
 */
async function loadQuestions (modulesIds) {

  const questionTypes = await con('taxonomies')
    .where('group', 'question')
    .where('code', 'written-answer')
  const type = questionTypes[0]

  // console.log(type);
  
  const query = `
    select *
    from
        questions
    where
        questions.type_id = :typeId
      and
        topic_id in (
            select t.id 
            from topics t 
                inner join summary_topics st on st.topic_id = t.id
                inner join users u on st.user_id = u.id
            where
                u.subworkspace_id in (${modulesIds.join()})
            group by t.id
        )
  `
  // logtime(query)

  const [rows] = await con.raw(query, { typeId: type.id })
  return rows
}

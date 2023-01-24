'use strict'
process.on('message', req => {
  exportarEvaluacionesAbiertas(req)
})

require('../error')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { getUserCriterionValues, loadUsersCriteriaValues,
  addActiveUsersCondition
} = require('../helper/Usuarios')
const moment = require('moment')
const { pluck, logtime } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

let headers = [
  'Última sesión',
  'Escuela',
  'Curso',
  'Tipo curso',
  'Tema',
]

async function exportarEvaluacionesAbiertas ({
  workspaceId, modulos, UsuariosActivos, UsuariosInactivos, escuelas, cursos, temas, start, end, areas, tipocurso
}) {
  // Generate Excel file header
  const headersEstaticos = await getGenericHeaders(workspaceId)
 

  // Load workspace criteria

  const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
  const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')

  // When no modules are provided, get its ids using its parent id

  if (modulos.length === 0) {
    modulos = await getSuboworkspacesIds(workspaceId)
  }

  // Load users with answers

  const users = await loadUsersQuestions(
    workspaceId, modulos, UsuariosActivos, UsuariosInactivos,
    escuelas, cursos, temas, start, end, areas, tipocurso
  )
  const usersIds = pluck(users, 'id')

  // Load workspace user criteria

  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)

  const questions = await loadQuestions(modulos)

  const { altHeaders, maxQuestions } = getCreatedHeaders(users, headers);
  await createHeaders(headersEstaticos.concat(altHeaders));

  // Add users to Excel rows
  for (const user of users) {
    const lastLogin = moment(user.last_login).format('DD/MM/YYYY H:mm:ss')

    const cellRow = []

    // Add default values

    cellRow.push(user.name)
    cellRow.push(user.lastname)
    cellRow.push(user.surname)
    cellRow.push(user.document)
    cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')

    // Add user's criterion values

    const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues)
    userValues.forEach(item => cellRow.push(item.criterion_value || '-'))

    // Add report values

    cellRow.push(lastLogin !== 'Invalid date' ? lastLogin : '-')
    cellRow.push(user.school_name || '-')
    cellRow.push(user.course_name || '-')
    cellRow.push(user.course_type || '-')
    cellRow.push(user.topic_name || '-')

    // === Questions Answers FP / Others ===
    const answers = user.answers;

    if(workspaceId === 25) {
      const countLimit = answers ? answers.length : 0;
      if(countLimit) {
        const questions = await getQuestionsByTopic(user.topic_id, countLimit);   

        answers.forEach((answer, index) => {
          if (answer) {
            const question = questions[index];

            cellRow.push(question ? strippedString(question.pregunta) : '-')
            cellRow.push(answer ? strippedString(answer.respuesta) : '-')
          }
        });
      }

    } else {
      if (answers) {
        answers.forEach((answer, index) => {
          if (answer) {
            const question = questions.find(q => q.id === answer.id)
            cellRow.push(question ? strippedString(question.pregunta) : '-')
            cellRow.push(answer ? strippedString(answer.respuesta) : '-')
          }
        });
      }
    }
    // === Questions Answers FP / Others ===

    // === if empty questions ===
    const emptyRows = (answers) ? maxQuestions - answers.length
                                : maxQuestions;
    for (let i = 0; i < emptyRows; i++) {
      cellRow.push('-');
      cellRow.push('-');
    }
    // === if empty questions ===

    worksheet.addRow(cellRow).commit()
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
               limit ${countLimit}`;

  // logtime(query);

  const [rows] = await con.raw(query);
  return rows;
}

function getCreatedHeaders(users, headers){
  
  let maxQuestions = 0;

  for (const user of users) {
    const answers = user.answers;
    if(answers) {
      const countAnswers = answers.length; 
      if(countAnswers > maxQuestions) maxQuestions = countAnswers;
    }
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

async function loadUsersQuestions (
  workspaceId, modulesIds, activeUsers, inactiveUsers,
  schoolsIds, coursesIds, topicsIds, start, end, areas, tipocurso
) {

  const questionTypes = await con('taxonomies')
    .where('group', 'question')
    .where('code', 'written-answer')
  const type = questionTypes[0]

  let query = `
    select 
        u.*,
        tax.name as course_type, 
        group_concat(distinct(s.name) separator ', ') school_name,
        c.name course_name,
        t.name topic_name,
        q.pregunta,
        q.id pregunta_id,
        st.answers,
        st.topic_id
            
      from users u
        inner join summary_topics st on u.id = st.user_id
        inner join topics t on t.id = st.topic_id
        inner join summary_courses sc on u.id = sc.user_id
        inner join courses c on t.course_id = c.id
        inner join taxonomies tax on tax.id = c.type_id
        inner join course_school cs on c.id = cs.course_id
        inner join schools s on cs.school_id = s.id 
        inner join school_workspace sw on s.id = sw.school_id
        inner join questions q on t.id = q.topic_id
  `

  const workspaceCondition = ` where 
      u.subworkspace_id in (${modulesIds.join()}) and
      sw.workspace_id = ${workspaceId} and 
      q.type_id = ${type.id} `

  if(areas.length > 0) {
    query += ` inner join criterion_value_user cvu on cvu.user_id = u.id
               inner join criterion_values cv on cvu.criterion_value_id = cv.id`
    query += workspaceCondition

    // query += ' and cv.value_text = :jobPosition'
    query += ` and 
                  ( cvu.criterion_value_id in ( `;
    areas.forEach(cv => query += `${cv},`);
    query = query.slice(0, -1);

    query += `) `;
    
    query += `) `;
  } else {
    query += workspaceCondition;
  } 

  // Add type_course and dates at ('created_at')
  if(!tipocurso) query += ` and not tax.code = 'free'`
  if(start) query += ` and date(st.updated_at) >= '${start}'`
  if(end) query += ` and date(st.updated_at) <= '${end}'`

  // Add condition for schools ids

  if (schoolsIds.length > 0) {
    query += ` and s.id in (${schoolsIds.join()})`
  }

  // Add condition for courses ids

  if (coursesIds.length > 0) {
    query += ` and c.id in (${coursesIds.join()})`
  }

  // Add condition for topics ids

  if (topicsIds) {
    if (topicsIds.length > 0) {
      query += ` and t.id in (${topicsIds.join()})`
    }
  }

  /*
  if (start && end) {
    query += ` and (
      st.updated_at between '${start} 00:00' and '${end} 23:59'
    )`
  }*/

  // Add user conditions and group sentence

  query = addActiveUsersCondition(query, activeUsers, inactiveUsers)
  query += ' group by u.id, t.id, st.id'

  // Execute query
  // logtime(query);

  const [rows] = await con.raw(query)
  return rows
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

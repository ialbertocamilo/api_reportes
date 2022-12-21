'use strict'
require('../error')
process.on('message', (requestData) => {
  visitas(requestData)
})

const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { response } = require('../response')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { getUserCriterionValues, loadUsersCriteriaValues, addActiveUsersCondition, getUsersCareersAreas,
        innerCriterionValueUser, havingProccessValueUser } = require('../helper/Usuarios')
const moment = require('moment')
const { pluck,logtime } = require('../helper/Helper')
const { getSuboworkspacesIds } = require('../helper/Workspace')
const { con } = require('../db')

let headers = [
  'Última sesión',
  'Escuela',
  'Curso',
  'Tipo curso',
  'Tema',
  'Visitas'
]

async function visitas ({ workspaceId, modulos, UsuariosActivos, UsuariosInactivos, 
  careers, areas, tipocurso, schools, courses , start, end }) {
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

  // users and usersData
  const { usersIds, usersData } = await getSubWorkspaceUsers(modulos);
  const usersTopicsData = await loadUsersWithVisits(
    workspaceId, modulos, UsuariosActivos, UsuariosInactivos, 
    careers, areas, tipocurso, schools, courses, 
    start, end
  );

  // console.log('data', usersData);

  // users criteria
  const usersCriterionValues = await loadUsersCriteriaValues(modulos, usersIds)
  
  // schools data
  const schoolsData = await getSchoolsWorkspace(workspaceId);
  const coursesData = await getCoursesWorkspace(workspaceId);
  const topicsData = await getTopicsWorkspace(workspaceId);

  let SaveUserId = 0;
  let SaveUserValues = [];
  let SaveLastLoginUser = '-';

  const arrayWorksheets = workbook.getWorksheet(1);


  let worksheetState = 0;
  let currentRowCount = 0;
  let currentWorkSheet = worksheet;

  worksheet.name = `Hoja ${worksheetState + 1}`;
  const countUserTopics = usersTopicsData.length;
  
  for (let i = 0; i < countUserTopics; i++) {
    const user = usersTopicsData[i];
    const cellRow = []
    // === user data ===
    const { name, lastname, surname, document: numdoc, active, last_login } = usersData[user.id];

    cellRow.push(name);
    cellRow.push(lastname);
    cellRow.push(surname);
    cellRow.push(numdoc);
    cellRow.push(active === 1 ? 'Activo' : 'Inactivo');
    // === user data ===

    // === user criteria ===
    if(SaveUserId === user.id) {
      SaveUserValues.forEach(item => cellRow.push(item.criterion_value || '-'));
      cellRow.push(SaveLastLoginUser);
    } else {
      
      SaveUserId = user.id
      const userValues = getUserCriterionValues(user.id, workspaceCriteriaNames, usersCriterionValues);
            userValues.forEach(item => cellRow.push(item.criterion_value || '-'));
      SaveUserValues = userValues;

      // lastLogin user
      const lastLogin = moment(last_login).format('DD/MM/YYYY H:mm:ss');
      const SaveLastLoginUser = (lastLogin !== 'Invalid date') ? lastLogin : '-';
      cellRow.push(SaveLastLoginUser);

    }
    // === user criteria ===

    // === schools data ===
    const { school_name } = schoolsData[user.school_id];
    cellRow.push(school_name);
    // === schools data ===

    // === course data ===
    const { course_name, taxonomie_name } = coursesData[user.course_id];
    cellRow.push(course_name);
    cellRow.push(taxonomie_name);
    // === course data ===

    // === topics data ===
    const { topic_name } = topicsData[user.topic_id];
    cellRow.push(topic_name);
    // === topics data ===

    cellRow.push(user.views)

    // Add row to sheet

    // Add sheet to limit
    if(currentRowCount === 500000) {

      currentRowCount = 0;
      worksheetState++;
      currentWorkSheet = workbook.addWorksheet(`Hoja ${worksheetState + 1}`);
      await createHeaders(headersEstaticos.concat(headers), null, currentWorkSheet);
    }
  
    currentRowCount++;
    currentWorkSheet.addRow(cellRow).commit();
  
  }

  if (currentWorkSheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Visitas' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}

/**
 * Load users with its courses and schools
 * @param workspaceId
 * @param {array} modulesIds
 * @param {boolean} activeUsers include active users
 * @param {boolean} inactiveUsers include inactive users
 * @param start
 * @param end
 * @returns {Promise<*[]|*>}
 */
async function loadUsersWithVisits (
  workspaceId, modulesIds, activeUsers, inactiveUsers,
  careers, areas, tipocurso, schools, courses, 
  start, end
) {

  // Base query
  let queryCondition = '';
  const MergeState = [...careers, ...areas].length > 0;

  if(MergeState) {

    const colsrelations = ` inner join summary_topics st on u.id = st.user_id `;
    const colsquery = ' u.id ';

    const InitialUsers = await getUsersCareersAreas(modulesIds, 
                                            activeUsers, inactiveUsers, 
                                            careers, areas,
                       
                                            colsquery,
                                            colsrelations);

    const InitialUsersIds = pluck(InitialUsers, 'id');
    if(!InitialUsersIds.length) return []; 

    queryCondition += ` where u.id in (${InitialUsersIds.join()}) and sw.workspace_id = ${workspaceId} `

  } else {
    queryCondition += ` where u.subworkspace_id in (${modulesIds.join()}) and sw.workspace_id = ${workspaceId} `
    queryCondition = addActiveUsersCondition(queryCondition, activeUsers, inactiveUsers, true);
  }


  let query = `
    select 
      
      st.user_id id,
      s.id school_id,
      c.id course_id,
      st.topic_id,
      st.views

    from users u

        inner join summary_topics st on
           st.user_id = u.id
        inner join topics t on
           t.id = st.topic_id
        inner join courses c on
           c.id = t.course_id
        inner join taxonomies tx on 
          tx.id = c.type_id
        inner join course_school cs on
           cs.course_id = c.id
        inner join schools s on
           s.id = cs.school_id
        inner join school_workspace sw on
           sw.school_id = s.id

        ${queryCondition} `

  // Add type_course 
  if(schools.length) query += ` and s.id in(${schools.join()}) `;
  if(courses.length) query += ` and c.id in(${courses.join()}) `;
  if(tipocurso) query +=  ` and tx.code = 'free'` 

  /*if (start && end) {
    query += ` and (
      st.updated_at between '${start} 00:00' and '${end} 23:59'
    )`
  }*/
    
  // query += '  group by u.id, t.id, st.id ';
  query += ' order by u.id ';

  // logtime(query);
  const [rows] = await con.raw(query)
  return rows
}

async function getSubWorkspaceUsers(modulesIds) {

  const query = `
  SELECT
    
    u.id,
    u.active,
    u.name,
    u.lastname,
    u.surname,
    u.document,
    u.last_login
    
  FROM users u
  WHERE u.subworkspace_id in (${modulesIds.join()}) 
  ORDER BY u.id `;

  const [ rows ] = await con.raw(query);

  //set id to key array;
  let schema = {};
  let usersIds = [];
  const countRows = rows.length;

  for (let i = 0; i < countRows; i++) {
    const currentRow = rows[i];
    const { id } = currentRow;

    usersIds.push(id);
    schema[id] = currentRow;
  }

  return { usersData: schema, usersIds };
}

async function getSchoolsWorkspace(workspaceId) {

  const query = `
  SELECT
    s.id,
    s.name school_name
  FROM schools s 
  INNER JOIN school_workspace sw ON
     sw.school_id = s.id
  WHERE
     sw.workspace_id = ${workspaceId}
  ORDER BY s.id`;

  const [ rows ] = await con.raw(query);

  //set id to key array;
  const schema = {};
  const countRows = rows.length;

  for (let i = 0; i < countRows; i++) {

    const currentRow = rows[i];
    const { id } = currentRow;

    schema[id] = currentRow;
  }

  return schema;
}


async function getCoursesWorkspace(workspaceId) {

  const query = `
  SELECT
    c.id,
    c.name course_name,
    tx.name taxonomie_name
  FROM courses c 
  INNER JOIN course_school cs ON
     cs.course_id = c.id
  INNER JOIN taxonomies tx on 
     tx.id = c.type_id
  INNER JOIN schools s ON
     s.id = cs.school_id
  INNER JOIN school_workspace sw ON
     sw.school_id = s.id
  WHERE
     sw.workspace_id = ${workspaceId}
  ORDER BY c.id`;

  const [ rows ] = await con.raw(query);

  //set id to key array;
  const schema = {};
  const countRows = rows.length;

  for (let i = 0; i < countRows; i++) {
    const currentRow = rows[i];
    const { id } = currentRow;

    schema[id] = currentRow;
  }

  return schema;
}

async function getTopicsWorkspace(workspaceId) {

  const query = `
  SELECT
    t.id,
    t.name topic_name
  FROM topics t
  INNER JOIN courses c ON
     c.id = t.course_id
  INNER JOIN course_school cs ON
     cs.course_id = c.id
  INNER JOIN schools s ON
     s.id = cs.school_id
  INNER JOIN school_workspace sw ON
     sw.school_id = s.id
  WHERE
     sw.workspace_id = ${workspaceId}
  ORDER BY t.id`;

  const [ rows ] = await con.raw(query);

  //set id to key array;
  const schema = {};
  const countRows = rows.length;

  for (let i = 0; i < countRows; i++) {
    const currentRow = rows[i];
    const { id } = currentRow;

    schema[id] = currentRow;
  }
  return schema;
}
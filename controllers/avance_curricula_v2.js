process.on('message', requestData => {
  AvanceCurricula(requestData)
})
require('../error')
const { con } = require('../db')
const { response } = require('../response')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { getUserCriterionValues, loadUsersCriteriaValues, 
        addActiveUsersCondition, innerCriterionValueUser, 
        havingProccessValueUser, getUsersNullAndNotNull,
        loadUsersBySubWorspaceIds } = require('../helper/Usuarios')
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')
const { pluck, logtime, groupArrayOfObjects_v2 } = require('../helper/Helper')
const { loadCourses, loadUsersSegmentedv2 } = require('../helper/SegmentationHselper')
const { loadSummaryCoursesByUsersAndCourses } = require('../helper/Summaries')
const { loadCompatiblesId } = require('../helper/CoursesTopicsHelper')
const { getSuboworkspacesIds } = require('../helper/Workspace')

// Headers for Excel file
const headers = [
  'CURSOS ASIGNADOS',
  'CURSOS COMPLETADOS',
  'AVANCE'
]

async function AvanceCurricula ({ 
  workspaceId, 
  modulos = [], 

  UsuariosActivos, 
  UsuariosInactivos, 

  validacion, 

  careers, 
  areas }) {

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

  let users_to_export = [];
  
  const courses = await loadCourses({ cursos, escuelas, tipocurso,
                                      CursosActivos, CursosInactivos }, 
                                      workspaceId);

  const StackUsersData = await loadUsersBySubWorspaceIds(modulos, true);

  for (const course of courses) {
    logtime(`CURRENT COURSE: ${course.course_id} - ${course.course_name}`);

    // datos de usuario - temas
    logtime(`-- start: user segmentation --`);
    const users = await loadUsersSegmentedv2CountCourses(
      course.course_id, 
      modulos, 
      areas,

      start_date, 
      end_date, 

      UsuariosActivos, 
      UsuariosInactivos,

      activeTopics,
      inactiveTopics
    );
    logtime(`-- end: user segmentation --`);
    
    console.log('users', users);
    /*
     // filtro para usuarios nulos y no nulos
    const { users_null, users_not_null } = getUsersNullAndNotNull(users);
    users_to_export = users_not_null;

    const compatibles_courses = await loadCompatiblesId(course.course_id);
    const pluck_compatibles_courses = pluck(compatibles_courses, "id");

    if (compatibles_courses.length > 0 && users_null.length > 0) {
      logtime(`INICIO COMPATIBLES`);

      // summary_course verifica si es compatible
      const sc_compatibles = await loadSummaryCoursesByUsersAndCourses(
        pluck(users_null, "id"),
        pluck_compatibles_courses
      );

      for (const user of users_null) {
        if (user.sc_created_at) {
          users_to_export.push(user); //usercourse
          continue;
        }

        //verificar compatible con 'user_id' y 'course_id'
        const sc_compatible = sc_compatibles
          .filter(
            (row) =>
              row.user_id == user.id &&
              pluck_compatibles_courses.includes(row.course_id)
          )
          .sort()[0];

        if (!sc_compatible) {
          users_to_export.push(user); //usercourse
          continue;
        }

        const { course_name, grade_average, advanced_percentage } = sc_compatible;

        const additionalData = {
          grade_average, 
          advanced_percentage,
          course_status_name: 'Convalidado',
          compatible: course_name
        }

        users_to_export.push({ ...user, ...additionalData }); // usercourse
      }

    } else {
      users_to_export = [...users_not_null, ...users_null];
    }

    for (const user of users_to_export) {

      const cellRow = [];

      // encontrar usuario por 'id'
      const { id } = user;
      const userStore = StackUsersData[id];
      const lastLogin = moment(userStore.last_login).format("DD/MM/YYYY H:mm:ss");
      cellRow.push(userStore.name);
      cellRow.push(userStore.lastname);
      cellRow.push(userStore.surname);
      cellRow.push(userStore.document);
      cellRow.push(userStore.active === 1 ? "Activo" : "Inactivo");
      cellRow.push(userStore.email);
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

      const passed = user.course_passed || 0;
      const taken = user.taken || 0;
      const reviewed = user.reviewed || 0;
      const completed = passed + taken + reviewed;

      cellRow.push(lastLogin !== "Invalid date" ? lastLogin : "-");
      cellRow.push(course.school_name);
      cellRow.push(course.course_name);
      cellRow.push(user.course_views || "-");
      cellRow.push(user.course_passed > 0 ? user.grade_average : "-");

      cellRow.push(
        user.advanced_percentage ? user.advanced_percentage + "%" : "0%"
      );
      cellRow.push(user.compatible || `-`);

      // añadir fila 
      worksheet.addRow(cellRow).commit();
    }*/
  }


  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'avance_curricula' }))
    })
  } else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}
  
/*
  const testData = [
    { id: 122, name:'test 000 - 122' },
    { id: 122, name:'test 001 - 122' },
    { id: 122, name:'test 002 - 122' },
    { id: 124, name:'test 000 - 124' },
    { id: 124, name:'test 001 - 124' },
    { id: 124, name:'test 002 - 124' },
    { id: 124, name:'test 003 - 124' },
    { id: 200, name:'test 002 - 200' }
  ];
  const responseData = groupArrayOfObjects_v2(testData);
  console.log(responseData);
  */
  // Execute query
  // logtime(query);
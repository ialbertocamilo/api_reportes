process.on('message', (requestData) => {
    exportarDiplomas(requestData);
});

require('../error');
const config = require('../config.js')
const moment = require('moment');
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs');
const { response } = require('../response');
const sequelize = require('../sequelize.js');
const { Op } = require('sequelize');

/* helpers */
const { logtime } = require('../helper/Helper');
const { getSchoolStatesWorkspace, 
        getSchoolCoursesStates, 
        BuildQueryAtDate } = require('../helper/Diplomas');
const {
        getUserCriterionValues2,
    } = require('../helper/Usuarios');
/* models */
const SummaryCourse = require('../models/SummaryCourse');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Course = require('../models/Course');
const CourseSchool = require('../models/CourseSchool');
const School = require('../models/School');
const Taxonomie = require('../models/Taxonomie');

let defaultHeaders = [
    'Módulo', //modulo user
    'Apellidos y Nombres',
    'Dni',
    'Estado (usuario)', //active user

    // 'Escuela', // school 
    // 'Estado (escuela)',// school estado active
    
    // 'Tipo de curso', // tipo de curso
    // 'Curso',
    // 'Estado (curso)',
    
    // 'Fecha en la que obtuvo el diploma', // issue DD/MM/YYYY
    // 'Fecha de aceptación del usuario', // accepted DD/MM/YYYY
    // 'Link ver diploma',
    // 'Link descarga diploma'
];
const headersReport = [
    'Escuela', // school 
    'Estado (escuela)',// school estado active
    
    'Tipo de curso', // tipo de curso
    'Curso',
    'Estado (curso)',
    
    'Fecha en la que obtuvo el diploma', // issue DD/MM/YYYY
    'Fecha de aceptación del usuario', // accepted DD/MM/YYYY
    'Link ver diploma',
    'Link descarga diploma'
]
async function exportarDiplomas({ data, states }) {
    
    const { estados_usuario, 
            estados_escuela, 
            estados_curso } = states;

    const { workspaceId, modules, date, 
            course: course_ids,
            school: school_ids } = data;
    // set criterion user values header
    let headersEstaticos = await getGenericHeadersByCriterioCodes(workspaceId);
            headersEstaticos.concat(headersReport)
            defaultHeaders.concat(headersEstaticos)
    // === schools and courses ===
    const stackSchools = !(school_ids.length) ? await getSchoolStatesWorkspace(workspaceId, estados_escuela) : 
                                                school_ids;
    const stackCourses = !(course_ids.length) ? await getSchoolCoursesStates(stackSchools, estados_curso) :
                                                course_ids;
    // === schools and courses === 

    // === check date range === 
    const queryAtDate = BuildQueryAtDate(date);

    const summaries = await SummaryCourse.findAll({
        ...queryAtDate,
        include:[   
                    {
                        // users
                        model: User, 
                        where: {
                            subworkspace_id: {
                                [Op.in]: modules
                            },
                            active:{
                                [Op.in]: estados_usuario
                            }
                        },
                        include: [ 
                            { model: Workspace } 
                        ]
                    },
                    {
                        // courses
                        model: Course,
                        where: {
                            id: {
                                [Op.in]: stackCourses
                            },
                            active: {
                                [Op.in]: estados_curso
                            }
                        },
                        include: [ 
                            { 
                                model: CourseSchool,
                                // schools
                                include: [ 
                                    { 
                                        model: School,
                                        where:{
                                            id: {
                                                [Op.in]: stackSchools
                                            },
                                            active: {
                                                [Op.in]: estados_escuela
                                            }
                                        }
                                    } 
                                ]
                            },
                            {
                                // taxonomies
                                model: Taxonomie
                            }
                        ]
                    }  
                ]
    });
    
    await createHeaders(defaultHeaders)

    //Custom filters
    const transformDate = (datetime) => {
        return datetime ? moment(datetime).format('DD/MM/YYYY') : '-';
        // return datetime ? moment(datetime).format('DD/MM/YYYY H:mm:ss') : '-';
    };
    const transformActive = (state) => state ? 'Activo' : 'Inactivo' ;
    //Custom filters
    let StackUserCriterios = {};

    for (const summarie of summaries) {
        
        const cellRow = [];

        // user
        const { user, course } = summarie;

        const fullName = `${user.surname || ''} ${user.lastname || ''} ${user.name || ''}`;
        const { workspace } = user;
        const userActive = transformActive(user.active);

        cellRow.push(workspace.name); // modulo - user
        cellRow.push(fullName); // apellidos y nombres
        cellRow.push(user.document); // dni
        cellRow.push(userActive); // estado - user
        if(StackUserCriterios[id]) {
            const StoreUserValues = StackUserCriterios[id];
            StoreUserValues.forEach((item) => cellRow.push(item.criterion_value || "-"));
          } else {
            const userValues =
              await getUserCriterionValues2(user.id, workspaceCriteriaNames, defaultsCriteriaIds);
                userValues.forEach((item) => cellRow.push(item.criterion_value || "-"));
                StackUserCriterios[id] = userValues; 
          }
        const { school } = course.course_school;
        const schoolActive = transformActive(school.active);
        cellRow.push(school.name); // escuela
        cellRow.push(schoolActive); // estado - escuela

        const typeCourse = course.taxonomy;
        cellRow.push(typeCourse.name); // tipo curso
        const courseActive = transformActive(course.active);
        cellRow.push(course.name); // curso
        cellRow.push(courseActive); // estado - curso


        const { certification_issued_at, certification_accepted_at } = summarie;
        const certification_issued = transformDate(certification_issued_at);
        const certification_accepted = transformDate(certification_accepted_at);

        cellRow.push(certification_issued); //fecha de emision
        cellRow.push(certification_accepted); //fecha de acceptacion
   
        cellRow.push(`${config.URL_TEST}/tools/ver_diploma/${user.id}/${course.id}`); //link de visualizacion
        cellRow.push(`${config.URL_TEST}/tools/dnc/${user.id}/${course.id}`); //link de descarga
 
        worksheet.addRow(cellRow).commit();
    }

    if (worksheet._rowZero > 1){
        workbook.commit().then(() => {
            process.send(response({ createAt, modulo: 'Diplomas' }));
        });
        //process.send({ modulo: 'Diplomas response_if', summaries });
    } else {
        process.send({ alert: 'No se encontraron resultados' });
        //process.send({ modulo: 'Diplomas response_else', summaries });
    }
}
  
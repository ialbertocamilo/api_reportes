process.on('message', (requestData) => {
    exportReportPollQuestion(requestData);
});

require('../error');
const moment = require('moment');
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs');
const { response } = require('../response');
const { pluck } = require('../helper/Helper.js')

const { pollQuestionReportData,loadSubWorkSpaces,loadSchoolsByCourse } = require('../helper/Poll.js')


let defaultHeaders = [
    'Módulo', //modulo user
];

async function exportReportPollQuestion(filters) {
    const es_anonimo = filters.poll.anonima;
    if(!es_anonimo){
        defaultHeaders = [...defaultHeaders,...['Nombre','Apellido Paterno','Apellido Materno','Documento']];
    }
    await createHeaders(defaultHeaders.concat(['Escuela','Curso','Pregunta','Respuesta','Fecha']));
    let [poll_questions_answers, subworkspaces,schools] = await Promise.all([
                                        pollQuestionReportData(filters),
                                        loadSubWorkSpaces(filters),
                                        loadSchoolsByCourse(filters)
                                    ]);
    for (const poll_questions_answer of poll_questions_answers) {
        const cellRow = [];
        const response_user = parseResponseUser(poll_questions_answer.respuestas,filters.type_poll_question); 
        const workspace = subworkspaces.find(subworkspace =>subworkspace.id == poll_questions_answer.subworkspace_id)
        const schools_name = pluck(schools.filter(s=>s.course_id == poll_questions_answer.course_id),'name').join(',');
        if(filters.type_poll_question == 'opcion-multiple' && response_user.length > 0){
            for (const response_user_multiple of response_user) {
                cellRow.push(workspace ? workspace.name : '-');
                if(!es_anonimo){
                    cellRow.push(poll_questions_answer.name);
                    cellRow.push(poll_questions_answer.lastname);
                    cellRow.push(poll_questions_answer.surname);
                    cellRow.push(poll_questions_answer.document);
                }
                cellRow.push(schools_name);
                cellRow.push(poll_questions_answer.course_name);
                cellRow.push(poll_questions_answer.titulo);
                // cellRow.push(poll_questions_answer.respuestas);
                cellRow.push(response_user_multiple);
                cellRow.push(moment(poll_questions_answer.created_at).format('DD/MM/YYYY H:mm:ss'));
                worksheet.addRow(cellRow).commit();
            }
        }else{
            cellRow.push(workspace ? workspace.name : '-');
            if(!es_anonimo){
                cellRow.push(poll_questions_answer.name);
                cellRow.push(poll_questions_answer.lastname);
                cellRow.push(poll_questions_answer.surname);
                cellRow.push(poll_questions_answer.document);
            }
            cellRow.push(schools_name);
            cellRow.push(poll_questions_answer.course_name);
            cellRow.push(poll_questions_answer.titulo);
            // cellRow.push(poll_questions_answer.respuestas);
            cellRow.push(response_user);
            cellRow.push(moment(poll_questions_answer.created_at).format('DD/MM/YYYY H:mm:ss'));
            worksheet.addRow(cellRow).commit();
        }
    }

    if (worksheet._rowZero > 1){
        workbook.commit().then(() => {
            process.send(response({ createAt, modulo: 'Reporte-Encuestas' }));
        });
    } else {
        process.send({ alert: 'No se encontraron resultados' });
    }
}
function parseResponseUser(response,type_poll_question){
    switch (type_poll_question.code) {
        case 'texto':
        return response;
        case 'califica':
            try {
                const parse_response = JSON.parse(response);
                return parse_response[0] ? parse_response[0].resp_cal : '-';
            } catch (e) {
                return '-';
            }
        case 'opcion-multiple':
            try {
                return JSON.parse(response);
            } catch (error) {
                return [];
            }
        default : 
        return response;
    }
}
  
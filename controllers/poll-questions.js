process.on('message', (requestData) => {
    exportReportPollQuestion(requestData);
});

require('../error');
const config = require('../config.js')
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
        const workspace = subworkspaces.find(subworkspace =>subworkspace.id == poll_questions_answer.subworkspace_id)
        const schools_name = pluck(schools.filter(s=>s.course_id == poll_questions_answer.course_id),'name').join(',');
        
        cellRow.push(workspace.name);
        if(!es_anonimo){
            cellRow.push(poll_questions_answer.name);
            cellRow.push(poll_questions_answer.lastname);
            cellRow.push(poll_questions_answer.surname);
            cellRow.push(poll_questions_answer.document);
        }
        cellRow.push(schools_name);
        cellRow.push(poll_questions_answer.course_name);
        cellRow.push(poll_questions_answer.titulo);
        cellRow.push(poll_questions_answer.respuestas);
        cellRow.push(moment(poll_questions_answer.created_at).format('DD/MM/YYYY H:mm:ss'));
        worksheet.addRow(cellRow).commit();
    }

    if (worksheet._rowZero > 1){
        workbook.commit().then(() => {
            process.send(response({ createAt, modulo: 'Poll-questions' }));
        });
        //process.send({ modulo: 'Diplomas response_if', summaries });
    } else {
        process.send({ alert: 'No se encontraron resultados' });
        //process.send({ modulo: 'Diplomas response_else', summaries });
    }
}
  
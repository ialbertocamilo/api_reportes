process.on('message', (requestData) => {
    exportReportPollQuestion(requestData);
});

require('../error');
const moment = require('moment');
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs');
const { response } = require('../response');
const { pluck } = require('../helper/Helper.js')

const { pollQuestionReportData,loadSubWorkSpaces,loadSchoolsByCourse,parseResponseUser } = require('../helper/Poll.js')


let defaultHeaders = [
    'Módulo', //modulo user
];

async function exportReportPollQuestion(filters) {
    const es_anonimo = filters.poll.anonima;
    if(!es_anonimo){
        defaultHeaders = [...defaultHeaders,...['Nombre','Apellido Paterno','Apellido Materno','Documento']];
    }
    if(filters.poll.type.code == 'xcurso'){
        defaultHeaders = [...defaultHeaders,...['Escuela','Curso']];
    }
    defaultHeaders = [...defaultHeaders,...['Pregunta']];
    if(filters.type_poll_question.code =='califica'){
        defaultHeaders = [...defaultHeaders,...['Respuesta numérica','Respuesta texto','Fecha']];
    }else{
        defaultHeaders = [...defaultHeaders,...['Respuesta','Fecha']];
    }
    await createHeaders(defaultHeaders);
    let [poll_questions_answers, subworkspaces,schools] = await Promise.all([
                                        pollQuestionReportData(filters),
                                        loadSubWorkSpaces(filters),
                                        loadSchoolsByCourse(filters)
                                    ]);
    const values_question_type_califica = [
        {numeric:5,value:'Muy bueno'},
        {numeric:4,value:'Bueno'},
        {numeric:3,value:'Regular'},
        {numeric:2,value:'Malo'},
        {numeric:1,value:'Muy malo'},
    ];
    for (const poll_questions_answer of poll_questions_answers) {
        const response_user = await parseResponseUser(poll_questions_answer.respuestas,filters.type_poll_question);

        const workspace = subworkspaces.find(subworkspace =>subworkspace.id == poll_questions_answer.subworkspace_id)
        const schools_name = pluck(schools.filter(s=>s.course_id == poll_questions_answer.course_id),'name').join(',');
        if(filters.type_poll_question.code == 'opcion-multiple' && response_user.length > 0){
            for (const response_user_multiple of response_user) {
                const cellRow = [];
                cellRow.push(workspace ? workspace.name : '-');
                if(!es_anonimo){
                    cellRow.push(poll_questions_answer.name);
                    cellRow.push(poll_questions_answer.lastname);
                    cellRow.push(poll_questions_answer.surname);
                    cellRow.push(poll_questions_answer.document);
                }
                if(filters.poll.type.code == 'xcurso'){
                    cellRow.push(schools_name);
                    cellRow.push(poll_questions_answer.course_name);
                }
                cellRow.push(poll_questions_answer.titulo);
                // cellRow.push(poll_questions_answer.respuestas);
                cellRow.push(response_user_multiple);
                cellRow.push(moment(poll_questions_answer.created_at).format('DD/MM/YYYY H:mm:ss'));
                worksheet.addRow(cellRow).commit();
            }
        }else{
            const cellRow = [];
            cellRow.push(workspace ? workspace.name : '-');
            if(!es_anonimo){
                cellRow.push(poll_questions_answer.name);
                cellRow.push(poll_questions_answer.lastname);
                cellRow.push(poll_questions_answer.surname);
                cellRow.push(poll_questions_answer.document);
            }
            if(filters.poll.type.code == 'xcurso'){
                cellRow.push(schools_name);
                cellRow.push(poll_questions_answer.course_name);
            }
            cellRow.push(poll_questions_answer.titulo);
            // cellRow.push(poll_questions_answer.respuestas);
            cellRow.push(response_user);
            if(filters.type_poll_question.code =='califica'){
                const value_text = values_question_type_califica.find(c=>c.numeric ==response_user ); 
                cellRow.push(value_text ? value_text.value : '-');
            }
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

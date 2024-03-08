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
/* models */
const { con } = require('../db')
// helpers
const { loadUsersSegmentedByCourse } = require('../helper/SegmentationHelper_v2.js')
const {loadUsersCheckists} = require('../helper/Checklist');
const {loadUsersPolls,parseResponseUser} = require('../helper/Poll');

const { getSuboworkspacesIds } = require('../helper/Workspace')
const {  formatDatetimeToString } = require('../helper/Helper')
let defaultHeaders = [
    'Módulo',
    'Documento',
    'Documento Instructor',
    'Nombre del Instructor',
    'Proceso',
    'Etapa',
    '% de valor de etapa',
    'Nombre Actividad',
    'Tipo de Actividad',
    'Porcentaje de valor de actividad',
    'Validación (Item)',
    'Visitas',
    'Estado',
    'Nota',
    'Cumplimiento',
    'Fecha y hora',
    'Respuesta',
];
async function exportarDiplomas({ processesIds, workspaceId }) {

    const processes = await loadProcesses(workspaceId, processesIds);
    const subworkspaces = await getSuboworkspacesIds(workspaceId,'all')

    await createHeaders(defaultHeaders)

    for (const _process of processes) {
        const users_id = await loadUsersSegmentedByCourse(_process.id, [], [], 1, 0, 'App\\Models\\Process', 'employee_onboarding', _process.instructors_id);
        console.log('users_id',users_id);
        if(users_id.length == 0){
            continue;
        }
        const instructors = await listInstructors(_process.instructors_id);
        await listUsersStatusByActivities(users_id,subworkspaces,_process,instructors[0]);
    }
    if (worksheet._rowZero > 1) {
        const dateFileName = Date.now();
        workbook.commit().then(() => {
            process.send(response({ createAt: dateFileName, file_ext: '.xlsx', modulo: 'ProcessProgress' }))
        })
    } else {
        process.send({ alert: 'No se encontraron resultados' })
    }
}

async function loadProcesses(workspaceId, processesIds) {
    const query = `select 
                        p.id,p.title,p.starts_at,p.finishes_at,
                        group_concat(s.id) as 'stages_id' ,count(s.id) as 'count_stages',
                        (SELECT COUNT(pri.user_id) FROM process_instructors pri WHERE pri.process_id = p.id) AS count_instructors,
                        (SELECT group_concat(pri.user_id) FROM process_instructors pri WHERE pri.process_id = p.id) AS instructors_id
                    from processes p join stages s on s.process_id = p.id 
                    where p.workspace_id=:workspace_id and p.id in (:processes_ids) and p.deleted_at is null and s.deleted_at is null and s.active =1
                    group by s.process_id 
                    order by count_stages desc,s.position asc;
                `
    const [processes] = await con.raw(query, {
        workspace_id: workspaceId,
        processes_ids: processesIds.join('')
    })
    return processes
}

async function listUsersStatusByActivities(users_id,subworkspaces,_process,instructors) {
    
    const activities = await loadActivitiesByStages(_process.stages_id);

    for (const activity of activities) {
        let array_activity = [];
        array_activity.push(instructors.instructors_documents || '-'); //DOCUMENTO Instructor
        array_activity.push(instructors.instructors_names || '-');//Nombre del Instructor
        array_activity.push(_process.title || '-')//Proceso
        array_activity.push(activity.etapa || '-')//Etapa
        array_activity.push(activity.percentage_ev ? activity.percentage_ev+'%' : '0%')//% de valor de etapa
        array_activity.push(activity.title || '-')//Nombre Actividad
        array_activity.push(activity.type_name || '-')//Tipo de Actividad
        array_activity.push(activity.qualification_percentage ? activity.qualification_percentage+'%' : '0%')//Porcentaje de valor de actividad
        switch (activity.code) {
            case 'tareas':
                users_status_projects = await loadUsersStatusProject(users_id,activity.model_id);
                for (const user_status_project of users_status_projects) {
                    let cellRow = [];
                    const subworkspace= subworkspaces.find(s => s.id == user_status_project.subworkspace_id);
                    // Add default values
                    cellRow.push(subworkspace.name || '-') // Módulo
                    cellRow.push(user_status_project.document || '-')//Documento

                    cellRow = cellRow.concat(array_activity)
                    
                    cellRow.push('-')//Validación (Item)
                    cellRow.push('-')//Visitas
                    cellRow.push(user_status_project.status || 'Pendiente')//Estado
                    cellRow.push('-')//Nota
                    cellRow.push('-')//Cumplimiento
                    cellRow.push(formatDatetimeToString(user_status_project.createAt))//Fecha y hora
                    cellRow.push('-')//Respuesta
                    worksheet.addRow(cellRow).commit()
                }
            break;
            case 'sesion_online':

            break;
            case 'temas':
                const users_status_topic = await loadUserStatusTopic(users_id,activity.model_id);
                for (const user_status_topic of users_status_topic) {
                    let cellRow = [];
                    const subworkspace= subworkspaces.find(s => s.id == user_status_topic.subworkspace_id);
                    // Add default values
                    cellRow.push(subworkspace.name || '-') // Módulo
                    cellRow.push(user_status_topic.document || '-')//Documento

                    cellRow = cellRow.concat(array_activity)
                    cellRow.push('-')//Validación (Item)
                    cellRow.push(user_status_topic.views)//Visitas
                    cellRow.push(user_status_topic.status)//Estado
                    cellRow.push(user_status_topic.grade)//Nota
                    cellRow.push('-')//Cumplimiento
                    cellRow.push(formatDatetimeToString(user_status_topic.topic_date))//Fecha y hora
                    cellRow.push('-')//Respuesta
                    worksheet.addRow(cellRow).commit()
                }
            break;
            case 'evaluacion':
                
            break;
            case 'checklist':
                const users_status_checklist = await loadUsersCheckists(null,[activity.model_id], null, null, true, false, null, null,[], users_id.map(u=> u.id));
                for (const user_status of users_status_checklist) {
                    let cellRow = [];
                    const subworkspace= subworkspaces.find(s => s.id == user_status.subworkspace_id);
                    // Add default values
                    cellRow.push(subworkspace.name || '-') // Módulo
                    cellRow.push(user_status.document || '-')//Documento
                    cellRow = cellRow.concat(array_activity)
                    cellRow.push(user_status.activity)//Validación (Item)
                    cellRow.push('-')//Visitas
                    cellRow.push(user_status.qualification)//Estado
                    cellRow.push('-')//Nota
                    cellRow.push('-')//Cumplimiento
                    cellRow.push(formatDatetimeToString(user_status.checklist_answer_created_at))//Fecha y hora
                    cellRow.push('-')//Respuesta
                    worksheet.addRow(cellRow).commit()
                }
            break;
            case 'encuesta':
                const users_answers = await loadUsersPolls(users_id,activity.model_id);
                // const users_answers = await loadUsersPolls([{id:87306,id:15766,id:16}],7);
                const values_question_type_califica = [
                    {numeric:5,value:'Muy bueno'},
                    {numeric:4,value:'Bueno'},
                    {numeric:3,value:'Regular'},
                    {numeric:2,value:'Malo'},
                    {numeric:1,value:'Muy malo'},
                ];
                for (const user_answer of users_answers) {
                    const subworkspace= subworkspaces.find(s => s.id == user_answer.subworkspace_id);
                    const response_user = await parseResponseUser(user_answer.respuestas,user_answer); 
                    let cellRow = [];
                    // Add default values
                    cellRow.push(subworkspace.name || '-') //MODULO
                    cellRow.push(user_answer.document || '-'); //DOCUMENTO
                    
                    cellRow = cellRow.concat(array_activity)

                    cellRow.push(user_answer.titulo);//Validación (Item)
                    cellRow.push('-');//Visitas
                    cellRow.push(user_answer.needs_override ? 'Pendiente' : 'Realizado');//Estado
                    cellRow.push('-');//Nota
                    cellRow.push('-');//Cumplimiento
                    cellRow.push(user_answer.created_at ? moment(user_answer.created_at).format('DD/MM/YYYY H:mm:ss') : '-');//Fecha y hora
                    if(user_answer.needs_override){
                        cellRow.push('-');//Respuesta
                    }else{
                        if(user_answer.code =='califica'){
                            const value_text = values_question_type_califica.find(c=>c.numeric ==response_user ); 
                            cellRow.push(value_text ? value_text.value : '-'); //RESPUESTA
                        }else{
                            cellRow.push(user_answer ? user_answer.respuestas : '-');//RESPUESTA
                        }
                    }
                    worksheet.addRow(cellRow).commit()
                }
            break;
        }
    }
}

async function listInstructors(instructors_id) {
    const query = `select group_concat(' ',document) as 'instructors_documents',group_concat(' ',concat_ws(' ',name,lastname,surname)) as 'instructors_names'
            from users 
            where id in (${instructors_id})`;
    const [instructors] = await con.raw(query);
    return instructors;
    
}

async function loadUsersStatusProject(users_id,project_id){
    const query = `
    SELECT 
        IF(pu.project_id IS NULL, 1, 0) AS needs_override,
        u.subworkspace_id,
        u.document,
        pu.created_at,
        t.name as status
    FROM 
        users u
    LEFT JOIN 
        project_users pu on pu.user_id = u.id and pu.project_id  = ${project_id}
    left join
        taxonomies t on t.id = pu.status_id 
    where u.id in (${users_id.map(u=>u.id).join()})
    `
    const [users_status_project] = await con.raw(query);
    return users_status_project;
}

async function loadActivitiesByStages(stages_id){
    const query_activities = `select s.qualification_percentage,s.title as etapa,a.id as activity_id,a.model_id,a.stage_id,a.title,a.percentage_ev,t.code,t.name as 'type_name'
    from activities a
    join taxonomies t on t.id = a.type_id
    join stages s on s.id =a.stage_id
    where a.deleted_at is null and a.stage_id in (${stages_id}) order by a.position asc;`;

    const [activities] = await con.raw(query_activities);
    return activities;
}

async function loadUserStatusTopic(users_id,topic_id){
    const query_users_status_topic = `
    SELECT 
        IF(st.topic_id IS NULL, 1, 0) AS needs_override,
        u.subworkspace_id,
        u.document,
        if(t.name is null,'Pendiente',t.name)as 'status',
        if(st.views is null,'0',st.views)as 'views',
        if(st.grade is null,'-',st.grade)as 'grade',
        if(st.last_time_evaluated_at is null,if(st.created_at is null,'-',st.created_at),st.last_time_evaluated_at) as 'topic_date'
    FROM 
        users u
    left join
        summary_topics st on st.user_id  = u.id and st.topic_id  = ${topic_id}
    left join
        taxonomies t on t.id = st.status_id 
    where u.id in (${users_id.map(u=>u.id).join()})
    `
    const [users_status_topic] = await con.raw(query_users_status_topic);
    return users_status_topic;
}
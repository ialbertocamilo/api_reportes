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
const { getSuboworkspacesIds } = require('../helper/Workspace')
const {  formatDatetimeToString } = require('../helper/Helper')
let defaultHeaders = [
    'Módulo',
    'Documento',
    'Instructor',
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
    'Valoración',
];
async function exportarDiplomas({ processesIds, workspaceId }) {

    const processes = await loadProcesses(workspaceId, processesIds);
    const subworkspaces = await getSuboworkspacesIds(workspaceId,'all')

    await createHeaders(defaultHeaders)

    for (const _process of processes) {
        const users_id = await loadUsersSegmentedByCourse(_process.id, [], [], 1, 0, 'App\\Models\\Process', 'employee_onboarding', _process.instructors_id);
        // const instructors = await listInstructors(_process.instructors_id);
        const prueba =await listUsersStatusByActivities(users_id,subworkspaces,_process);
        process.send({ alert: prueba })

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
                    order by count_stages desc,s.position asc;
                `
    const [processes] = await con.raw(query, {
        workspace_id: workspaceId,
        processes_ids: processesIds.join('')
    })
    return processes
}

async function listUsersStatusByActivities(users_id,subworkspaces,_process) {
    const query_activities = `select s.qualification_percentage,s.title as etapa,a.id as activity_id,a.model_id,a.stage_id,a.title,a.percentage_ev,t.code,t.name as 'type_name'
                                from activities a
                                join taxonomies t on t.id = a.type_id
                                join stages s on s.id =a.stage_id
                                where a.deleted_at is null and a.stage_id in (:stages_id) order by a.position asc;`;

    const [activities] = await con.raw(query_activities, { stages_id: _process.stages_id });
    const query_users = `select w.name,u.document,t.code, psua.activity_id from users u
                    join workspaces w on w.id=u.subworkspace_id
                    left join process_summary_users_activities psua on psua.user_id  = u.id 
                    left join taxonomies t ON t.id = psua.status_id
                    where u.id in (${users_id.map(u => u.id).join(',')}) and (psua.activity_id is null or psua.activity_id in (:activities_id));`
    
    const [users] = await con.raw(query_users, {
                        activities_id: activities.map(a => a.id).join(","),
                    });
    for (const activity of activities) {
        switch (activity.code) {
            case 'tareas':

            break;
            case 'sesion_online':

            break;
            case 'temas':
                
            break;
            
            case 'evaluacion':

            break;
            case 'checklist':
                const cellRow = [];
                const users_status_checklist = await loadUsersCheckists(null,[activity.model_id], null, null, true, false, null, null,[], users_id.map(u=> u.id));
                for (const user_status of users_status_checklist) {
                    const subworkspace= subworkspaces.find(s => s.id == user_status.subworkspace_id);
                    // Add default values
                    cellRow.push(subworkspace.name || '-')
                    cellRow.push(user_status.document || '-')
                    cellRow.push(user_status.trainer_document || '-')
                    cellRow.push(user_status.trainer_name || '-')
                    cellRow.push(_process.title || '-')
                    cellRow.push(activity.etapa || '-')
                    cellRow.push(activity.percentage_ev ? activity.percentage_ev+'%' : '0%')
                    cellRow.push(activity.title || '-')
                    cellRow.push(activity.type_name || '-')
                    cellRow.push(activity.qualification_percentage ? activity.qualification_percentage+'%' : '0%')
                    cellRow.push(user_status.activity)
                    cellRow.push('-')
                    cellRow.push(user_status.qualification)
                    cellRow.push('-')
                    cellRow.push('-')
                    cellRow.push(formatDatetimeToString(user_status.checklist_answer_created_at))
                    cellRow.push('-')
                    worksheet.addRow(cellRow).commit()
                }
            break;
            
            case 'encuesta':
                return 'as'
            break;
        }
    }
}
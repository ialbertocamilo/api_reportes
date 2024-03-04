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
const {loadUsersSegmentedByCourse} = require('../helper/SegmentationHelper_v2.js')
let defaultHeaders = [
    'Proceso',
    'Fecha de inicio',
    'Fecha estima de fin',
    'Duración (días)',
    'N Etapas',
    'Usuarios registrados',
    'Cant. De Supervisores',
    'Usuarios Pendientes (no iniciados)',
    'Pendientes (No iniciados)',
    'Usuarios En Progreso',
    'En Progreso',
    'Usuarios Completados',
    'Completados'
];
async function exportarDiplomas({modulesIds }) {

    const processes = await loadProcesses();
    const maxStages = processes[0].count_stages;
    for (let index = 0; index < maxStages; index++) {
        defaultHeaders.push(`Etapa ${index+1} (usuarios)`);
        defaultHeaders.push(`Etapa ${index+1} (%)`);
    }
    await createHeaders(defaultHeaders)

    for (const _process of processes) {
        let cellRow = [];
        const users_id = await loadUsersSegmentedByCourse(_process.id,modulesIds,[],1,0,'App\\Models\\Process','employee_onboarding',_process.instructors_id);
        if(users_id.length==0){
            continue;
        }
        const start_at = moment(_process.starts_at);
        const finishes_at =  moment(_process.finishes_at);
        const diffDays = finishes_at.diff(start_at, 'days');
        const [processStatus, stageStatus] = await Promise.all([
                                                listQuantityUsersInProcessByStatus(users_id, _process.id),
                                                listQuantityUsersInStagesByStatus(users_id, _process.stages_id)
                                            ]);
        const {
            quantity_users_pending,
            percent_users_pending,
            quantity_users_in_progress,
            percent_users_in_progress,
            quantity_users_completed,
            percent_users_completed,
        } = processStatus;

        cellRow.push(_process.title)
        cellRow.push(start_at.format('YYYY-MM-DD'))
        cellRow.push(finishes_at.format('YYYY-MM-DD'))
        cellRow.push(diffDays)
        cellRow.push(_process.count_stages)
        cellRow.push(users_id ? users_id.length : 0)
        cellRow.push(_process.count_instructors)
        cellRow.push(quantity_users_pending)
        cellRow.push(percent_users_pending)
        cellRow.push(quantity_users_in_progress)
        cellRow.push(percent_users_in_progress)
        cellRow.push(quantity_users_completed)
        cellRow.push(percent_users_completed)
        for (const status_stage of stageStatus) {
            cellRow.push(status_stage.quantity_users_completed)
            cellRow.push(status_stage.percent_users_completed)
        }
        worksheet.addRow(cellRow).commit()
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

async function loadProcesses() {
    const query = `select 
                        p.id,p.title,p.starts_at,p.finishes_at,
                        group_concat(s.id) as 'stages_id' ,count(s.id) as 'count_stages',
                        (SELECT COUNT(pri.user_id) FROM process_instructors pri WHERE pri.process_id = p.id) AS count_instructors,
                        (SELECT group_concat(pri.user_id) FROM process_instructors pri WHERE pri.process_id = p.id) AS instructors_id
                    from processes p join stages s on s.process_id = p.id 
                    where  p.deleted_at is null and s.deleted_at is null and s.active =1
                    order by count_stages desc,s.position asc;
                `
    const [processes] = await con.raw(query)
    return processes
}
async function listQuantityUsersInProcessByStatus(users_id,process_id){
    const count_users = users_id.length;
 
     const query = `select t.code from process_summary_users psu
             join taxonomies t on t.id = psu.status_id 
             where psu.process_id = ${process_id} and psu.user_id in (${users_id.map(u => u.id).join(",")})
         `; 
     const [users_status_in_stages] = await con.raw(query);
 
     const quantity_users_in_progress = users_status_in_stages.filter(us => us.code == 'in-progress').length;
     const percent_users_in_progress = quantity_users_in_progress>0 ? quantity_users_in_progress/count_users : 0;
     const quantity_users_completed = users_status_in_stages.filter(us => us.code == 'completed').length;
     const percent_users_completed = quantity_users_completed>0 ? quantity_users_completed/count_users : 0;
     const calculate_users_pending = count_users - (quantity_users_in_progress + quantity_users_completed);
     const quantity_users_pending = calculate_users_pending > 0 ? calculate_users_pending : 0;
     const percent_users_pending = quantity_users_pending>0 ? quantity_users_pending/count_users : 0;;
     
     return {
         quantity_users_pending: quantity_users_pending,
         percent_users_pending: (percent_users_pending*100) + '%',
         quantity_users_in_progress: quantity_users_in_progress,
         percent_users_in_progress: (percent_users_in_progress*100) + '%',
         quantity_users_completed: quantity_users_completed,
         percent_users_completed: (percent_users_completed*100) + '%'
     };
}
async function listQuantityUsersInStagesByStatus(users_id,stages_id){
   const count_users = users_id.length;

    const query = `select t.code from process_summary_users_stages psus
            join taxonomies t on t.id = psus.status_id 
            where psus.stage_id in (${stages_id}) and psus.user_id in (${users_id.map(u => u.id).join(",")})
        `; 
    const [users_status_in_stages] = await con.raw(query);
    let users_status = [];
    stages_id = stages_id.split(",");
    for (const stage_id of stages_id) {
        const quantity_users_completed = users_status_in_stages.filter(us => us.code == 'completed').length; 
        const percent_users_completed =  quantity_users_completed>0 ? quantity_users_completed/count_users : 0;
        users_status.push({
            quantity_users_completed: quantity_users_completed ,
            percent_users_completed : (percent_users_completed*100) + '%',
            stage_id:stage_id
        })
    }
    return users_status;
}
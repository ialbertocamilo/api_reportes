process.on('message', (requestData) => {
    exportAssists(requestData);
});

require('../error');
const config = require('../config.js')
const moment = require('moment');
const { response } = require('../response');
const { Op } = require('sequelize');
const { con } = require('../db')
/* helpers */
const {
    loadCoursesV3,
    loadUsersSegmentedv2,
} = require("../helper/SegmentationHelper_v2");
const { getSuboworkspacesIds } = require("../helper/Workspace");
// const { createAt } = require('../exceljs');
const { zipPdfsAndUploadFilesInS3,downloadFile } = require('../s3/storage')
const { stringToSlug } = require('../helper/Helper')
const { generatePdf } = require('../helper/pdf-helper.js')
const fs = require('fs');
const { CARPETA_DESCARGA } = require("../config");

async function exportAssists({ modulos = [], 
    workspaceId, 
    cursos, 
    temas,
    escuelas, 
    tipocurso,
    CursosActivos = false, CursosInactivos = false,
    activeTopics=false,inactiveTopics=false,
    activeUsers=false,inactiveUsers=false
 }) {
    if (modulos.length === 0) {
        modulos = await getSuboworkspacesIds(workspaceId);
    }
    const courses = await loadCoursesV3({ cursos, escuelas, tipocurso,
        CursosActivos, CursosInactivos }, 
        modulos);

    const pdfs = [];
    for (const course of courses) {
        const course_modality_in_person_properties = JSON.parse(course.modality_in_person_properties);
        const required_signature = course_modality_in_person_properties ? course_modality_in_person_properties.required_signature : false;
        const [topics,assigned_users, assistances] = await Promise.all([
            loadTopicsByCourseId(course,temas,activeTopics,inactiveTopics),
            loadUsersSegmentedv2(
                course.course_id,
                modulos,
                [],
                null,
                null,
                activeUsers,
                inactiveUsers,
                true,
                true
            ),
            loadAssistsByCourse(course)
        ]);
        for (const topic of topics) {
            
            const topic_modality_in_person_properties = JSON.parse(topic.modality_in_person_properties);
            const datetime = topic_modality_in_person_properties.start_date+' '+topic_modality_in_person_properties.start_time;

            const startDatetime = moment(`${topic_modality_in_person_properties.start_date} ${topic_modality_in_person_properties.start_time}`, 'YYYY-MM-DD HH:mm');
            const finishDatetime = moment(`${topic_modality_in_person_properties.start_date} ${topic_modality_in_person_properties.finish_time}`, 'YYYY-MM-DD HH:mm');
            const diff = moment.duration(finishDatetime.diff(startDatetime));
            const duration = `${String(diff.hours()).padStart(2, '0')}:${String(diff.minutes()).padStart(2, '0')}`;

            const [host, cohost] = await Promise.all([
                loadUser(topic_modality_in_person_properties.host_id),
                loadUser(topic_modality_in_person_properties.cohost_id)
            ]);
            const users = await formatUser(assigned_users,assistances,topic,required_signature);
            const session_data = {
                'users' : users,
                'assigned_users' : assigned_users.length,
                'required_signature' : required_signature,
                'colspan' : required_signature ? '4' : '3',
                'course_name':course.course_name,
                'session_name':topic.name,
                'datetime':datetime,
                'host' : host.fullname,
                'cohost' :cohost ? cohost.cohost : null,
                'duration':duration
            };
            //Configure PDF
            const options_pdf = {
                displayHeaderFooter: true,
                printBackground :true,
                format: "A4",
                headerTemplate: `
                <div style="font-size: 10px; margin: 0px 10px 10px 10px;width:100%;display: flex;justify-content: space-between;">
                    <div style="display: inline-block; margin-right: 10px;">CURSO: ${course.course_name}</div>
                    <div style="display: inline-block; margin-right: 10px;">SESIÓN: ${topic.name}</div>
                    <div style="display: inline-block; margin-right: 10px;">FECHA: ${datetime}</div>
                    <div style="display: inline-block;">
                        Pág: <span class="pageNumber"></span>
                    </div>
                    </div>
                `,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                // <div style="display: inline-block;">
                //     <span class="pageNumber"></span> / <span class="totalPages"></span>
                // </div>
                footerTemplate: '-',
                margin: { top: "40px", bottom: "40px",left:'10px',right : '10px' },
            };
            // const filename = stringToSlug(course.course_name)+'/'+stringToSlug('listado-de-asistencia-'+topic.name)+'.pdf';
            const filename = topic.id+stringToSlug('listado-de-asistencia-'+topic.name)+'.pdf';
            console.log(filename,'filename');
            const PDF = await generatePdf("./templates/pdf/assistances-in-person.hbs",session_data,options_pdf);
            const filePath = CARPETA_DESCARGA+'/'+filename;
            await fs.writeFileSync(filePath, PDF);
            pdfs.push({
                filePath:filePath,
                folder_name:stringToSlug(course.course_name),
                filename:filename
            });
        }
    }

    // process.send(response({ createAt: pdfs,file_ext:'.zip',modulo: 'assistance' }))
    //UPLOAD FILE
    const dateFileName = Date.now();
    const zipFileName =dateFileName +'.zip';
    await zipPdfsAndUploadFilesInS3(pdfs, zipFileName);
    console.log('entra');
    process.send(response({ createAt: dateFileName,file_ext:'.zip',modulo: 'assistance' }))
}

async function loadAssistsByCourse(course) {
    const query = `select  topic_id,user_id,ta.name,tau.signature from topic_assistance_user tau 
                    join topics t on t.id = tau.topic_id
                    join taxonomies ta on ta.id = tau.status_id 
                    where t.course_id = ${course.course_id};`
    const [assistances] = await con.raw(query)
    return assistances
}

async function loadTopicsByCourseId(course,temas,activeTopics,inactiveTopics){
    let query = `SELECT id,name,modality_in_person_properties FROM topics t 
                    where t.deleted_at is null and ${temas.length==0 ? `t.course_id = ${course.course_id}` : `t.id in (${temas.join()}) `}
                `
    if (activeTopics && !inactiveTopics) {
        query += ' and t.active = 1'
    }
    if (!activeTopics && inactiveTopics) {
        query += ' and t.active = 0'
    }
    const [topics] = await con.raw(query+=';')
    return topics
} 

async function loadUser(user_id){
    if(!user_id){
        return null;
    }
    let query = `SELECT  id, name, document, CONCAT_WS(' ', name, lastname, surname) AS fullname  FROM users u where id = ${user_id};`;
    const [user] = await con.raw(query)
    return user[0];
}

async function formatUser(assigned_users,assistances,topic,required_signature){
    let users = [];
    for (const user of assigned_users) {
        const status_user = assistances.find(a => a.topic_id == topic.id && a.user_id == user.id);
        let signature = null;
        if(required_signature){
            signature = status_user ?  status_user.signature : null;
        }  
        users.push({
            'id' : user.id,
            'fullname' : `${user.name ? user.name : ''} ${user.lastname ? user.lastname : ''} ${user.surname ? user.surname : ''}`,
            'document' : user.document,
            'status_name' : status_user ? status_user.name : 'No asistió',
            'signature' : signature ? await downloadFile(signature,300,false) : '-'
        });
    }
    return users;
}
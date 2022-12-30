const { con } = require('../db');
const { pluck } = require('./Helper')

exports.pollQuestionReportData =async({courses_selected,modules,poll,type_poll_question,date})=>{
    const poll_questions_ids = await con('poll_questions').select('id').where('poll_id',poll.id).whereNull('deleted_at').where('type_id',type_poll_question.id);
    let select_query = ['pq.titulo','pqa.respuestas','pqa.course_id','c.name as course_name','pqa.created_at','u.subworkspace_id']; 
    if(!poll.anonima){
        select_query = [...select_query,...['u.name','u.lastname','u.surname','u.document']]; 
    }
        
    const where_between_dates = (date.start && date.end) ? `and pqa.created_at BETWEEN "${date.start}" and "${date.end}"` : ''; 
    const query = `
    select ${select_query} from  poll_question_answers pqa
    join users as u on u.id = pqa.user_id
    join poll_questions as pq on pq.id = pqa.poll_question_id
    join courses c on c.id = pqa.course_id
    where u.active =1 and u.deleted_at is null
    and u.subworkspace_id in (${modules.toString()})
    and pqa.course_id in (${courses_selected.toString()})
    and pqa.poll_question_id in (${pluck(poll_questions_ids,'id').toString()}) ${where_between_dates}`
    const [rows]  = await con.raw(query);
    return rows;
    // return await con('poll_question_answers as pqa')
    // .join('users as u','u.id','pqa.user_id')
    // .join('poll_questions as pq','pq.id','pqa.poll_question_id')
    // // .join('workspaces as w','w.id','w.subworkspace_id')
    // .join('courses as c','c.id','pqa.course_id')
    // .select(select_query)
    // .where('u.active',1)
    // .whereNull('u.deleted_at')
    // .whereIn('u.subworkspace_id',modules)
    // .whereIn('pqa.course_id', courses_id_selected)
    // .whereIn('pqa.poll_question_id',pluck(poll_questions_ids,'id'))
    // .whereBetween
    
}
exports.loadSubWorkSpaces = async({modules})=>{
    return await con('workspaces').select('id','name').whereIn('id',modules);
}
exports.loadSchoolsByCourse = async({courses_selected})=>{
    return await con('course_school as cs')
                .select('s.name','cs.course_id')
                .join('schools as s','s.id','=','cs.school_id')
                .whereIn('cs.course_id',courses_selected);
}
const { con } = require('../db');
const { pluck } = require('./Helper')

exports.pollQuestionReportData =async({courses_selected,modules,poll,type_poll_question,date})=>{
    const poll_questions_ids = await con('poll_questions').select('id').where('poll_id',poll.id).whereNull('deleted_at').where('type_id',type_poll_question.id);
    let select_query = poll.type.code == 'xcurso' 
                                    ?   ['pq.titulo','pqa.respuestas','pqa.course_id','c.name as course_name','pqa.created_at','u.subworkspace_id']
                                    :   ['pq.titulo','pqa.respuestas','pqa.created_at','u.subworkspace_id']; 
    if(!poll.anonima){
        select_query = [...select_query,...['u.name','u.lastname','u.surname','u.document']]; 
    }
        
    const where_between_dates = (date.start && date.end) ? `and pqa.created_at BETWEEN '${date.start}' and '${date.end}' order by pqa.created_at desc` : ''; 
    let query = `
    select ${select_query} from  poll_question_answers pqa
    join users as u on u.id = pqa.user_id join poll_questions as pq on pq.id = pqa.poll_question_id `;
    query += poll.type.code == 'xcurso' ? ' join courses c on c.id = pqa.course_id ' :'';
    query += ` where u.active =1 and u.deleted_at is null and u.subworkspace_id in (${modules.toString()}) `;
    query += poll.type.code == 'xcurso' ? ` and pqa.course_id in (${courses_selected.toString()})` : '';
    query += `and pqa.poll_question_id in (${pluck(poll_questions_ids,'id').toString()}) `;
    query += where_between_dates; 
    console.log(query);
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
exports.parseResponseUser = async (response,type_poll_question)=>{
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
exports.loadUsersPolls= async (users_id,poll_id)=>{
    const query_questions = `
    select pq.titulo,pq.id,t.code from poll_questions pq 
    LEFT JOIN taxonomies t on t.id = pq.type_id 
    where pq.poll_id = :pollId and pq.deleted_at is null and pq.active =1`; 
    const [questions] = await con.raw(query_questions, {
        pollId: poll_id,
    })
    const query_users_polls_answers = `
    SELECT 
        IF(pqa.poll_question_id IS NULL, 1, 0) AS needs_override,
        u.subworkspace_id,
        u.document,
        pq.titulo,
        t.code,
        pqa.poll_question_id,
        pqa.respuestas,
        pqa.created_at
    FROM 
        users u
    LEFT JOIN 
        poll_question_answers pqa ON pqa.user_id = u.id and pqa.poll_question_id  in (${questions.map(u=>u.id).join()})
    LEFT JOIN 
        poll_questions pq on pq.id = pqa.poll_question_id
    LEFT JOIN 
        taxonomies t on t.id = pq.type_id 
    WHERE 
        u.id IN (${users_id.map(u=>u.id).join()})
    `
    let [users_polls_answers] = await con.raw(query_users_polls_answers)
    let newItems = [];
    users_polls_answers = users_polls_answers.map((r) => {
        if (r.needs_override) {
            questions.forEach(question => {
                let new_item = {};
                Object.assign(new_item, r);
                new_item.titulo = question.titulo
                new_item.code = question.code
                newItems.push(new_item);
            });
            return null
        }
        return r
    }).filter((element) => element !== null);
    return users_polls_answers.concat(newItems)
}
const { con } = require("../db")
const {groupArrayOfObjects,uniqueElements,pluckUnique} = require('./Helper');

exports.loadUsersSegmented = async (course_id) => {
    // select `id` from `users` 
    // inner join `criterion_value_user` as `cvu1` on `users`.`id` = `cvu1`.`user_id` and `cvu1`.`criterion_value_id` in (?) 
    // inner join `criterion_value_user` as `cvu46` on `users`.`id` = `cvu46`.`user_id` and `cvu46`.`criterion_value_id` in (?) 
    // where `active` = ?
    const segments = await con('segments_values as sv')
                    .select('sv.criterion_id','sv.segment_id','sv.criterion_value_id')
                    .join('segments as sg','sg.id','sv.segment_id')
                    .where('sg.model_type','App\\Models\\Course')
                    .where('sg.model_id',course_id)
                    .where('sg.deleted_at',null)
                    .where('sv.deleted_at',null)
    const segments_groupby =  groupArrayOfObjects(segments,'segment_id','get_array');
    let users = []
    for(segment of segments_groupby){
        const grouped = groupArrayOfObjects(segment,'criterion_id','get_array'); 
        let join_criterions_values_user = ''; 
        grouped.forEach((values,idx) => {
            const criterios_id = pluckUnique(values,'criterion_value_id').toString();
            join_criterions_values_user += 
            `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
        });
        const [rows] = await con.raw(`select users.id , users.name,users.lastname,users.surname,users.email, users.document ,sc.grade_average,sc.status_id from users
        LEFT OUTER join summary_courses sc on sc.user_id = users.id and sc.course_id = ${course_id}
        ${join_criterions_values_user} 
        where users.active=1 
        and users.deleted_at is null`)
        if(rows.length >0){
            users = [...users,...rows]
        }
    }
    return uniqueElements(users,'id');
}

exports.loadCourses = async ({cursos,escuelas}) => {
    const where_courses = cursos.length == 0 ? {
        label : 'cs.school_id',
        value : escuelas
    } : {
        label : 'cs.course_id',
        value : cursos
    }
    return await con('course_school as cs')
    .select('cs.course_id','c.name as course_name','sc.name as school_name')
    .join('courses as c','c.id','cs.course_id')
    .join('schools as sc','sc.id','cs.school_id')
    .whereIn( where_courses.label,where_courses.value)
    .where('c.active',1)
    .groupBy('cs.course_id')
}

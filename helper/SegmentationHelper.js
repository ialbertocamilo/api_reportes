const { con } = require("../db")

exports.loadUsersSegmented = async (courses_id) => {
    // select `id` from `users` 
    // inner join `criterion_value_user` as `cvu1` on `users`.`id` = `cvu1`.`user_id` and `cvu1`.`criterion_value_id` in (?) 
    // inner join `criterion_value_user` as `cvu46` on `users`.`id` = `cvu46`.`user_id` and `cvu46`.`criterion_value_id` in (?) 
    // where `active` = ?
    return []; 
}

exports.loadCourses = async (escuelas_id) => {
    return con('course_school')
    .select('course_school.course_id')
    .join('courses','courses.id','course_school.course_id')
    .whereIn('school_id',escuelas_id)
    .where('courses.active',1)
    .groupBy('course_id')
}

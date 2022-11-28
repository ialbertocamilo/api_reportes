const { con } = require("../db");

exports.loadSummaryCoursesByUsersAndCourses = async (users_id, courses_id) => {
  const [rows] = await con.raw(
    `
          select 
            cs.course_id, c.name as course_name, sc.name as school_name,
            sc.grade_average, sc.advanced_percentage, sc.status_id
          from 
            course_schools cs
            join courses c on c.id = cs.course_id and c.active = 1
            join schools s on s.id = cs.school_id and s.active = 1
            join summary_courses as sc on sc.course_id = c.id
          where 
            sc.course_id in (${courses_id.join()})
            and sc.user_id in (${users_id.join()})

      `
  );

  return rows;
};

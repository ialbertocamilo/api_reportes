const { con } = require("../db");
const { logtime } = require("./Helper");

exports.loadSummaryCoursesByUsersAndCourses = async (users_id, courses_id) => {
  courses_id = courses_id.filter((val) => val != null);
  users_id = users_id.filter((val) => val != null);

  const [rows] = await con.raw(
    `
          select 
            cs.course_id, c.name as course_name, s.name as school_name,
            sc.user_id, sc.grade_average, sc.advanced_percentage, sc.status_id,
            sc.views as course_views, sc.passed as course_passed, sc.assigned, sc.completed,
            sc.last_time_evaluated_at, sc.restarts as course_restarts, sc.taken, sc.reviewed,

            sc.status_id as course_status_id

          from 
            course_school cs

            join courses c on c.id = cs.course_id and c.active = 1
            join schools s on s.id = cs.school_id and s.active = 1
            join summary_courses as sc on sc.course_id = c.id and cs.course_id = c.id 
              and sc.status_id = 4568

            LEFT OUTER join taxonomies t1 on t1.id = sc.status_id

          where 
            sc.course_id in (${courses_id.join()})
            and sc.user_id in (${users_id.join()})
      `
  );

  return rows;
};

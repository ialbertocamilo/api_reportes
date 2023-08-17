const { con } = require("../db");
const { logtime } = require("./Helper");

exports.loadSummaryCoursesByUsersAndCourses = async (
  users_id, 
  courses_id) => {

  courses_id = courses_id.filter((val) => val != null);
  users_id = users_id.filter((val) => val != null);

  let query =  `

     select
        sc.user_id,
        cs.course_id,
        c.name course_name,
        c.qualification_type_id,
        sc.grade_average, 
        sc.advanced_percentage,
        sc.assigned,
        sc.views,
        sc.restarts,
        sc.status_id,
        (sc.passed + sc.taken + sc.reviewed) as completed

      from 

        course_school cs

        join courses c 
          on c.id = cs.course_id 
        join schools s 
          on s.id = cs.school_id 
        join summary_courses sc 
          on sc.course_id = c.id  and cs.course_id = c.id 
        left outer join taxonomies tx 
          on tx.id = sc.status_id

        where
         sc.delete_at is null and
          c.active = 1 and s.active = 1
          and sc.status_id = 4568 -- aprobados
          and sc.course_id in (${courses_id.join()})
          and sc.user_id in (${users_id.join()})
      `;
  
  // logtime(query);

  const [rows] = await con.raw(query);
  return rows;
};


exports.loadSummaryCoursesByUsersAndCoursesTopics = async (
  users_id, 
  courses_id) => {

  courses_id = courses_id.filter((val) => val != null);
  users_id = users_id.filter((val) => val != null);              

  let query =  `

     select   
        cs.course_id,
        sc.user_id,
        c.name course_name

      from 

        course_school cs

        join courses c 
          on c.id = cs.course_id 
        join schools s 
          on s.id = cs.school_id 
        join summary_courses sc 
          on sc.course_id = c.id and cs.course_id = c.id 

        where
         sc.delete_at is null and
          c.active = 1 and s.active = 1
          and sc.status_id = 4568
          and sc.course_id in (${courses_id.join()})
          and sc.user_id in (${users_id.join()})
      `;
  
  // logtime(query);

  const [rows] = await con.raw(query);
  return rows;
};

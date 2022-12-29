const { con } = require("../db");
const { logtime } = require("./Helper");

exports.loadSummaryCoursesByUsersAndCourses = async (
  users_id, 
  courses_id) => {

  courses_id = courses_id.filter((val) => val != null);
  users_id = users_id.filter((val) => val != null);              

  let query =  `

     select   
        cs.course_id,
        c.name course_name, 
        s.name school_name,
        sc.user_id,
        sc.grade_average, 
        sc.advanced_percentage,
        sc.views course_views, 
        sc.passed course_passed, 
        sc.assigned, 
        sc.completed,
        sc.last_time_evaluated_at, 
        sc.restarts course_restarts, 
        sc.taken, 
        sc.reviewed,
        sc.status_id course_status_id

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
          c.active = 1 and s.active = 1
          and sc.status_id = 4568
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
        c.name course_name, 
        s.name school_name,
        sc.user_id,
        sc.grade_average, 
        sc.advanced_percentage,
        sc.views course_views, 
        sc.passed course_passed, 
        sc.assigned, 
        sc.completed,
        sc.last_time_evaluated_at, 
        sc.restarts course_restarts, 
        sc.taken, 
        sc.reviewed,
        sc.status_id course_status_id

      from 

        course_school cs

        join courses c 
          on c.id = cs.course_id 
        join schools s 
          on s.id = cs.school_id 
        join summary_courses sc 
          on sc.course_id = c.id and cs.course_id = c.id 
        
        inner join topics t 
          on t.course_id = sc.course_id 

        left outer join summary_topics st 
          on st.topic_id = t.id 
        left outer join taxonomies tx 
          on tx.id = sc.status_id

        where 
          c.active = 1 and s.active = 1
          and sc.status_id = 4568
          and sc.course_id in (${courses_id.join()})
          and sc.user_id in (${users_id.join()})
      `;
  
  logtime(query);

  const [rows] = await con.raw(query);
  return rows;
};
